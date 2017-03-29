/*global angular:true, browser:true */

/**
 * @license angular-yii2-model Module for AngularJS
 * (c) 2017 Salem Ouerdani
 * License: MIT
 */

(function() {
  'use strict';

  angular
   .module('angular-yii2-model', [])
   .provider('YiiModel', YiiModel);


  YiiModel.$inject = [];
  function YiiModel() {

    var $http;
    var config;

    this.baseUrl = '';
    
    this.totalCountHeader  = 'X-Pagination-Total-Count';
    this.pageCountHeader   = 'X-Pagination-Page-Count';
    this.currentPageHeader = 'X-Pagination-Current-Page';
    this.perPageHeader     = 'X-Pagination-Per-Page';

    /**
     * BaseModel
    **/
    
    function BaseModel(route) {
        if (typeof route !== 'string') throw new Error("route name is missing");

        var _route = route,
            _expand,
            _fields,
            _headers;

        Object.defineProperty(this, '$route', {
            get: function() { return _route },
        });
        Object.defineProperty(this, '$expand', {
            get: function() { return _expand },
            set: function(value) { _expand = angular.isArray(value) ? value.join() : value }
        });
        Object.defineProperty(this, '$fields', {
            get: function() { return _fields },
            set: function(value) { _fields = angular.isArray(value) ? value.join() : value }
        });
        Object.defineProperty(this, '$baseUrl', {
            get: function() { return config.baseUrl + '/' + this.$route },
        });
        Object.defineProperty(this, '$headers', {
            get: function() { return _headers },
            set: function(obj) {
              if (_isPlainObject(obj) === false)
                throw new Error("input should be contained inside an object");
              _headers = obj;
            }
        });
    };

    BaseModel.prototype = {
        $select: function(fields) { this.$fields = fields },
        $with: function(resource) { this.$expand = resource },
        $setHeaders: function(config) { this.$headers = config },
    };


    /**
     * Collection extends BaseModel 
    **/
    function Collection(route) {
        BaseModel.call(this, route);

        this.$data = [];
        this.$meta = {};

        var _perPage = 20,
            _page = 1,
            _links = {},
            _filters = {};

        Object.defineProperty(this, '$perPage', {
            get: function() { return _perPage },
            set: function(value) { _perPage = value }
        });
        Object.defineProperty(this, '$page', {
            get: function() { return _page },
            set: function(value) { _page = value }
        });
        Object.defineProperty(this, '$links', {
            get: function() { return _links },
            set: function(obj) {
              if (_isPlainObject(obj) === false || typeof obj.self === "undefined")
                throw new Error("unexpected structure for the navigation links parsed from the response headers");
              _links = obj;
            }
        });
        Object.defineProperty(this, '$filters', {
            get: function() { return _filters },
            set: function(obj) {
              if (_isPlainObject(obj) === false)
                throw new Error("input should be contained in an object");
              _filters = obj;
            }
        });
        Object.defineProperty(this, '$params', {
            get: function() { 
              return angular.extend({
              'per-page': this.$perPage,
              'page': this.$page,
              'expand': this.$expand,
              'fields': this.$fields,
            }, this.$filters); 
          },
        });
    };

    Collection.prototype = Object.create( BaseModel.prototype );
    Collection.prototype.constructor = Collection;
    angular.extend( Collection.prototype , {
      $load: function(perPage) {
            var $this = this;
            if (perPage) this.$perPage = perPage;
            return $http({
                url: this.$baseUrl,
                method: "GET",
                params: this.$params,
                headers: this.$headers
            })
            .then(function successCallback(response) {
                _responseParser.call($this, response);
                return $this;
            });
        },
        // meta methods
        $isFirst:   function() { return this.$meta.currentPage === 1 },
        $isLast:    function() { return this.$meta.currentPage === this.$meta.pageCount },
        $existNext: function() { return typeof this.$links.next !== "undefined" },
        $existPrev: function() { return typeof this.$links.prev !== "undefined" },
        // pagination methods
        $firstPage: function() {
            if (this.$isFirst() === true) return;
            return _getByUrl.call(this, this.$links.first);
        },
        $nextPage: function() {
            if (this.$existNext() === false) return;
            return _getByUrl.call(this, this.$links.next);
        },
        $prevPage: function() {
            if (this.$existPrev() === false) return;
            return _getByUrl.call(this, this.$links.prev);
        },
        $lastPage: function() {
            if (this.$isLast() === true) return;
            return _getByUrl.call(this, this.$links.last);
        },
        $getPage: function(pageNumber) {
            if (pageNumber === this.$meta.currentPage || pageNumber > this.$meta.totalCount) return;
            this.$page = pageNumber;
            return this.$load();
        },
        $refresh: function() { return _getByUrl.call(this, this.$links.self) },
        // filtering
        $where: function(params) {
            this.$filters = params;
            return this.$load();
        },
    });


    /**
     * Resource extends BaseModel 
    **/
    function Resource(route) {
        BaseModel.call(this, route);

        var _primaryKey = 'id';
        var _fromServer = false;
        var _errors = {};

        Object.defineProperty(this, '$primaryKey', {
            get: function() { return _primaryKey },
            set: function(value) { _primaryKey = value }
        });
        Object.defineProperty(this, '$fromServer', {
            get: function() { return _fromServer },
            set: function(value) { _fromServer = value }
        });
        Object.defineProperty(this, '$errors', {
            get: function() { return _errors },
            set: function(value) { _errors = value }
        });
    };

    Resource.prototype = Object.create( BaseModel.prototype );
    Resource.prototype.constructor = Resource;
    angular.extend( Resource.prototype , {
      $setData: function(item) {
          angular.extend(this, item);
      },
      $find: function(id) {
          if (typeof id === "undefined") throw new Error("item id is required");
          var $this = this;
          return $http({
              url: this.$baseUrl + '/' + id,
              method: "GET",
              params: { expand: this.$expand, fields: this.$fields },
              headers: this.$headers
          })
          .then(function successCallback(response) {
              $this.$setData(response.data);
              $this.$fromServer = true;
              return $this;
          });
      },

      $getPrimaryKey: function() { return this[this.$primaryKey] },
      $isNew: function() { return this.$fromServer === false || typeof this.$getPrimaryKey() === "undefined" },
      $hasErrors: function() {
        if (this.$errors.constructor !== Object) throw new Error("$errors is expected to be an object");
        return Object.keys(this.$errors).length !== 0;
      },
      $clearErrors: function() {
        if (this.$hasErrors() === true) this.$errors = {};
      },
      $update: function() {
          if (this.$isNew()) throw new Error("item should be first saved");
          this.$clearErrors();
          var $this = this;
          return $http({
              url: this.$baseUrl + '/' + this.$getPrimaryKey(),
              method: "PUT",
              params: { expand: this.$expand, fields: this.$fields },
              headers: this.$headers,
              data: this
          })
          .then(function successCallback(response) {
              $this.$setData(response.data);
              return $this;
          },
          function errorCallback(error) {
              if (error.status === 422) {
                angular.forEach(error.data, function(e) {
                  var errObj = { 
                    message: e.message,
                    pattern: '(?!^'+ _preg_quote($this[e.field]) +'$)(^.*$)'
                  };
                  $this.$errors[e.field] = errObj;
                });
              }
          });
      },

      $create: function() {
          this.$clearErrors();
          var $this = this;
          return $http({
              url: this.$baseUrl,
              method: "POST",
              params: { expand: this.$expand, fields: this.$fields },
              headers: this.$headers,
              data: this
          })
          .then(function successCallback(response) {
              $this.$setData(response.data);
              $this.$fromServer = true;
              return $this;
          },
          function errorCallback(error) {
              if (error.status === 422) {
                angular.forEach(error.data, function(e) {
                  var errObj = { 
                    message: e.message,
                    pattern: '(?!^'+ _preg_quote($this[e.field]) +'$)(^.*$)'
                  };
                  $this.$errors[e.field] = errObj;
                });
              }
          });
      },

      $save: function() { return this.$isNew() ? this.$create() : this.$update() },
      $delete: function() {
          if (this.$isNew()) throw new Error("item is not yet saved");
          var $this = this;
          return $http({
              url: this.$baseUrl + '/' + this.$getPrimaryKey(),
              method: "DELETE",
              headers: this.$headers
          })
          .then(function successCallback() {
              $this.$fromServer = false;
              return $this;
          });
      },
    });


    /**
     * private helper methods
    **/


    var _isPlainObject = function (obj) {
        //source: http://stackoverflow.com/questions/5876332/how-can-i-differentiate-between-an-object-literal-other-javascript-objects#answer-5878101
        if (typeof obj == 'object' && obj !== null) {
          if (typeof Object.getPrototypeOf == 'function') {
            var proto = Object.getPrototypeOf(obj);
            return proto === Object.prototype || proto === null;
          }
          return Object.prototype.toString.call(obj) == '[object Object]';
        }
        return false;
    }


    var _parse_link_header = function(header) {
        var links = {},
            parts = header.split(',');
        
        for (var i = 0; i < parts.length; i++) {
            var section = parts[i].split(';');
            if (section.length != 2) throw new Error("section could not be split on ';'");
            var url = section[0].replace(/<(.*)>/, '$1').trim();
            var name = section[1].replace(/rel=(.*)/, '$1').trim();
            links[name] = decodeURIComponent(url);
        };

        return links;
    };


    var _parse_url_params = function(url) {
      var params = {},
          parts = url.slice(url.indexOf('?') + 1).split('&');

      for (var i = 0; i < parts.length; i++) {
          var query = parts[i].split('=');
          params[query[0]] = query[1];
      }

      return params;
    };


    var _preg_quote = function(str, delimiter) {
      //  discuss at: http://locutus.io/php/preg_quote/
      // original by: booeyOH
      // improved by: Ates Goral (http://magnetiq.com)
      // improved by: Kevin van Zonneveld (http://kvz.io)
      // improved by: Brett Zamir (http://brett-zamir.me)
      // bugfixed by: Onno Marsman (https://twitter.com/onnomarsman)
      //   example 1: preg_quote("$40")
      //   returns 1: '\\$40'
      //   example 2: preg_quote("*RRRING* Hello?")
      //   returns 2: '\\*RRRING\\* Hello\\?'
      //   example 3: preg_quote("\\.+*?[^]$(){}=!<>|:")
      //   returns 3: '\\\\\\.\\+\\*\\?\\[\\^\\]\\$\\(\\)\\{\\}\\=\\!\\<\\>\\|\\:'
      return (str + '')
        .replace(new RegExp('[.\\\\+*?\\[\\^\\]$(){}=!<>|:\\' + (delimiter || '') + '-]', 'g'), '\\$&')
    };


    var _getByUrl = function(url) {
        var $this = this;
        return $http.get(url, { headers: this.$headers })
        .then(function successCallback(response) {
            _responseParser.call($this, response);
            return $this;
        });
    }


    var _responseParser = function(response) {
        this.$data = response.data;

        this.$meta.currentPage = +response.headers(config.currentPageHeader);
        this.$meta.pageCount   = +response.headers(config.pageCountHeader);
        this.$meta.perPage     = +response.headers(config.perPageHeader);
        this.$meta.totalCount  = +response.headers(config.totalCountHeader);

        var headerLink = response.headers('Link');

        if (headerLink === null || headerLink.length === 0) 
          throw new Error("Enable to parse headers. Be sure 'baseUrl' to Yii server is correct and the 'Link' header is exposed to the browser as shown in this extension's README.md file.");

        this.$links = _parse_link_header(headerLink);

        // update local params
        if (this.$links.self) {
          var params = _parse_url_params(this.$links.self);
          if (params.perPage) this.$perPage = +params.perPage;
          if (params.page)    this.$page    = +params.page;
          if (params.expand)  this.$expand  = params.expand;
          if (params.fields)  this.$fields  = params.fields;
        }
    }


    this.$get = provider;
    provider.$inject = ['$http'];
    function provider(_$http_) {
      config = this;
      // http://stackoverflow.com/questions/19171207/injecting-dependencies-into-provider#answer-34657324
      $http = _$http_;
      return {
        all: function(route) { return new Collection(route) },
        one: function(route) { return new Resource(route) }
      };
    }
}

})();