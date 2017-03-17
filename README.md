
# angular-yii2-model

A lightweight AngularJS 1.x service designed to consume the [Yii2 RESTful API framework](http://www.yiiframework.com/doc-2.0/guide-rest-quick-start.html) and its built-in [HATEOAS](https://en.wikipedia.org/wiki/HATEOAS).

## Installation

- Install via bower: `bower install --save angular-yii2-model`
- or via npm: `npm install --save angular-yii2-model`
-  or by manually [downloading the zip file](https://github.com/tunecino/angular-yii2-model/archive/master.zip) and including either `dist/angular-yii2-model.js` or `dist/angular-yii2-model.min.js` to your HTML script tags.

## Configurations
####Client:
```javascript
// Add it as a dependency to your app
angular.module('your-app', ['angular-yii2-model']);

// Configure the provider to define the `baseUrl` to your Yii2 RESTful API 
angular.module('your-app').config(['YiiModelProvider', function(YiiModelProvider) {
	YiiModelProvider.baseUrl = 'http://localhost/server/api';
}]);

```
####Server:
You don't need to enable any [data serializing](http://www.yiiframework.com/doc-2.0/guide-rest-response-formatting.html#data-serializing) when using this extension as those data are already provided by Yii within the response headers. So I'd prefer to save my bandwidth transfer rate and parse the headers. The only change that you may have to do is to ensure that those headers are exposed to the browser when implementing the [CORS filter](http://www.yiiframework.com/doc-2.0/guide-rest-controllers.html#cors) within an [Access-Control-Expose-Headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Expose-Headers) tag. The following is a controller example that I've been using when building this extension:

```php
namespace app\controllers;

class UserController extends \yii\rest\ActiveController
{
    public $modelClass = 'app\models\User';

    public function behaviors()
	{
	    $behaviors = parent::behaviors();
	    unset($behaviors['authenticator']);
	    
	    // CORS filter
	    $behaviors['corsFilter'] = [
	        'class' => \yii\filters\Cors::className(),
	        'cors' => [
                'Origin' => ['*'],
                'Access-Control-Request-Method' => ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
                'Access-Control-Allow-Credentials' => true,
                'Access-Control-Expose-Headers' => [
                    // Calulated hyperlinks
                    'Link',
                    // Pagination
                    'X-Pagination-Current-Page',
                    'X-Pagination-Page-Count',
                    'X-Pagination-Per-Page',
                    'X-Pagination-Total-Count'
                ],
            ],
	    ];
	    
	    // Authentication filter
	    $behaviors['authenticator'] = [
            'class' => \yii\filters\auth\HttpBearerAuth::className(),
            'except' => ['options'],
        ],
        
	    return $behaviors;
	}
}
```

## Usage
This is an example using the resolve method of the [angular-ui-router](https://ui-router.github.io/ng1/) library to load a *collection*, a *resource* and an *empty instance* to use with new creations:
```javascript
.state('form', {
    url: '/form',
    controllerAs: '$',
    controller: 'FormCtrl',
    templateUrl: 'form.html',
    resolve: {
      allUsers: function(YiiModel) {
        /*
         * Load a collection of 10 users. we need their 'id' and 'username' fields only.
         * The request to achieve: GET /users?fields=id,username&page=1&per-page=10
        **/
        var users = YiiModel.all('users');
        users.$select(['id','username']); // accepts a string or an array of strings. optional and can be used with both resources and collections.
        return users.$load(10); // returns a promise. required to emit the request that gets the collection.
      },
      UserNumberOne: function(YiiModel) {
        /*
         * Load the user resource whose ID is 1. we also need to load his 'profile'.
         * The request to achieve: GET /users/1?expand=profile
        **/
        var user = YiiModel.one('users');
        user.$with('profile'); // accepts a string or an array of strings. optional and can be used with both resources and collections.
        return user.$find(1); // returns a promise. required to emit the request that gets the resource.
      },
      newUser: function(YiiModel) {
        /*
         * Just an empty instance of user so we can POST it later to server.
        **/
        return YiiModel.one('users');
      },
    }
});
```

Then, they should be passed to some controller where they could be used or injected to some view's scope: 

```javascript
angular.module('your-app').controller('FormCtrl', function($scope, allUsers, UserNumberOne, newUser) {
  var $ = this;
  $.allUsers = allUsers;
  $.userNumberOne = UserNumberOne;
  $.newUser = newUser;
});
```
Alternatively; if not using ui-router; both `$load()` and `$find()` methods are returning a `$http` promise and could be used as follow: 

```javascript
angular.module('your-app').controller('FormCtrl', function($scope, YiiModel) {
  var $ = this;

   var users = YiiModel.one('users');
   users.$select(['id','username']);
   users.$load(10).then(function(data){
   	   $.allUsers = data;
   });

});
```

###Playing with collections:
```javascript
$.allUsers.$data // <- here you'll find your data

// clear collection and load the fifth page content.
$.allUsers.$getPage(5)

// load the next page content (page 6).
$.allUsers.$nextPage()

// load the previous page content.
$.allUsers.$prevPage()

// jump to last page.
$.allUsers.$lastPage()

// load first page content.
$.allUsers.$firstPage()

// reload current data from server.
$.allUsers.$refresh()

// returns a boolean. true if current page is first.
$.allUsers.$isFirst()

// returns a boolean. true if current page is the last one.
$.allUsers.$isLast()

// returns a boolean. true if there is a next page.
$.allUsers.$existNext()

// returns a boolean. true if there is a previous page.
$.allUsers.$existPrev()

// reload with extra url params: 
// GET /users?fields=id,username&page=1&per-page=10&name=lukaku&club=everton
$.allUsers.$where({name: 'lukaku', club: 'everton'})

// outputs what parsed from the headers meta tags. For more details see: http://www.yiiframework.com/doc-2.0/guide-rest-resources.html#collections
$.allUsers.$meta.currentPage //X-Pagination-Current-Page
$.allUsers.$meta.pageCount //X-Pagination-Page-Count
$.allUsers.$meta.perPage //X-Pagination-Per-Page
$.allUsers.$meta.totalCount //X-Pagination-Total-Count
```

###Playing with resources:
```javascript
// changes the default primary Key attribute. default to 'id'.
$.userNumberOne.$primaryKey = 'user_id';

// returns the primary Key value.
$.userNumberOne.$getPrimaryKey() // outputs 1

// returns a boolean. either it is or not a new record and not loaded from server.
$.userNumberOne.$isNew() // returns false
$.newUser.$isNew() // returns true

// makes a delete request: DELETE /users/1
$.userNumberOne.$delete()

// makes a PUT request after changing an attribute value: PUT /users/1 {name: 'abc', ...}
$.userNumberOne.name = 'abc';
$.userNumberOne.$update();

// makes a POST request to create a new record: POST /users {name: 'xyz', ...}
$.newUser.name = 'xyz';
$.newUser.$create();

// either updates or creates depending on model being or not a new record. same as: $.newUser.$isNew() ? $.newUser.$create() : $.newUser.$update();
$.newUser.$save();
```

##Handling server-side validation

There is always validation cases that client cannot handle like checking if an input value is unique in a database. Of course those could only be handled by the server. And in case of Yii framework rejecting an input by throwing a data validation fail error *(422)* . This extension will add an `$errors` attribute to your model where you'll find the **field name** being rejected, the **error message** as received from the server and a **pattern regex** generated by this extension so you can use it to prevent client from re-sending the same input:

```javascript
{
	"username": {
		"message": "Username \"lukaku\" has already been taken.",
		"pattern": "(?!^lukaku$)(^.*$)"
	}
}
```

Client in this case doesn't even need to understand why server has rejected that input as we can simply use angular's `ng-pattern` attribute to make it know that whatever input it was, user shouldn't send it again as server won't approve it. Here is a HTML form validation example using angular built-in services while showing any extra error message received from the server and feeding the `ng-pattern` attribute with our pattern regex to prevent re-sending it again:


```html
<form name="form" ng-submit="$.newUser.$save()" novalidate>

    <!-- USERNAME -->
    <div>
        <label>Username</label>
        <input 
        	type="text" 
        	name="username" 
        	ng-model="$.newUser.username"
        	ng-pattern="$.newUser.$errors.username.pattern" 
        	ng-minlength="3"
        	ng-maxlength="8"
        	required
        >
        <p class="error-msg" ng-show="form.username.$dirty && form.username.$error.required">Username is required</p>
        <p class="error-msg" ng-show="form.username.$dirty && form.username.$error.minlength">too short</p>
        <p class="error-msg" ng-show="form.username.$dirty && form.username.$error.maxlength">too long</p>
        <p class="error-msg" ng-show="$.newUser.$errors.username && form.username.$error.pattern"> {{$.newUser.$errors.username.message}} </p>
    </div>
    
    <!-- SUBMIT BUTTON -->
    <button type="submit">Submit</button>
    
</form>
```
Also note that you can always check if a model instance is holding any error received from server by calling `$.newUser.$hasErrors()` which returns a boolean value. those could also be cleared by calling `$.newUser.$clearErrors()`.

##Authentication and custom Headers
This extension has a `$setHeaders()` method which you can use to define a custom set of headers within a java-script object to be sent with all requests of a specific model like the one required for Authentication:


```javascript
resolve: {
  allUsers: function(YiiModel) {
    var users = YiiModel.all('users');
    users.$setHeaders({'Authorization': 'Bearer ' + token });
    return users.$load(20);
  }
}
```
However nothing is provided by this extension to hold default or global headers for all requests as it is already built on top of angular's [http](https://docs.angularjs.org/api/ng/service/$http) core service which already supports such configurations like setting its `$http.defaults.headers` property in a run block or using interceptors. more about it [here](http://stackoverflow.com/questions/27134840/setting-angularjs-http-headers-globally). 


##Data Filtering
At the time of writing there is no official support to data searching or filtering by the Yii2 RESTful API framework as it is yet under discussion [here](https://github.com/yiisoft/yii2/issues/4479). But implementing data filtering in the Yii2 isn't hard. There is many ways to achieve it. One of those is by involving a *Search Class* like the one generated by the [gii](http://www.yiiframework.com/doc-2.0/guide-start-gii.html) module to filter your data:

```php
class UserSearch extends \app\models\User
{
    public function rules() ...
    public function scenarios() ...

    public function search($params, $formName = null)
    {
        $query = \app\models\User::find();

        // add conditions that should always apply here

        $dataProvider = new ActiveDataProvider([
            'query' => $query,
        ]);

        $this->load($params, $formName); // remember that you can pass `formName` directly to the `load()` method

        if (!$this->validate()) {
            $query->where('0=1');
            return $formName === '' ? $this : $dataProvider;
        }
    }
}


class UserController extends \yii\rest\ActiveController
{

    // ...

    public function actions()
    {
        $actions = parent::actions();

        $actions['index'] = [
            'class' => 'yii\rest\IndexAction',
            'modelClass' => $this->modelClass,
            'prepareDataProvider' => function () {
                $searchModel = new \app\models\UserSearch();
                return $searchModel->search(\Yii::$app->request->queryParams, '');
            },
        ];

        return $actions;
    }
}
```
*(based on [klimov-paul 's comment](https://github.com/yiisoft/yii2/pull/12641#issuecomment-253789966). an alternative but same approach may also be found [here](http://stackoverflow.com/questions/25522462/yii2-rest-query/30560912#30560912))*

Once implemented in the server-side. The `$where()` method provided by this extension will help filtering your resources by updating its data array as soon as the new filtered list is received from the server. Here is a quick example on how to use it with a search input:

```javascript
<input 
	type="text"
	placeholder="Search by name" 
	ng-model="query" 
	ng-change="$.allUsers.$where({name: query});"
	ng-model-options="{updateOn:'default blur', debounce:{'default':500, 'blur':0}}"
>
<pre>{{ $.allUsers.$data | json}}</pre>
```
*(note: the debounce trick here is to prevent sending a new request with each typing and wait for user to stop writing instead)*