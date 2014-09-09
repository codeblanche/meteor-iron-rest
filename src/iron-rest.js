/*
 * A REST implementation using IronRouter
 */

/**
 * @constructor
 * @param {Meteor.Collection} collection
 * @param {{}} options
 *
 * Options:
 *   collectionFilters : {} // http://docs.meteor.com/#find supported selectors
 *   collectionOptions : {} // http://docs.meteor.com/#find supported options
 *   allowView         : true // boolean or function () { return true }
 *   allowInsert       : true // boolean or function () { return true }
 *   allowUpdate       : true // boolean or function () { return true }
 *   allowDelete       : true // boolean or function () { return true }
 *   beforeView        : null // function (documentOrList) { return documentOrList or false to cancel },
 *   afterView         : null // function (documentOrList) {},
 *   beforeInsert      : null // function (document) { return document or false to cancel },
 *   afterInsert       : null // function (document) {},
 *   beforeUpdate      : null // function (document) { return document or false to cancel },
 *   afterUpdate       : null // function (document) {},
 *   beforeDelete      : null // function (documentId) { return true or false to cancel },
 *   afterDelete       : null // function (documentId) {}
 */
var EndPoint = function (collection, options) {
  var self = this;

  /**
   * @type {{collectionFilters: {}, collectionOptions: {}, allowView: boolean, allowInsert: boolean, allowUpdate: boolean, allowDelete: boolean, beforeView: null, afterView: null, beforeInsert: null, afterInsert: null, beforeUpdate: null, afterUpdate: null, beforeDelete: null, afterDelete: null}}
   */
  var defaultSettings = {
    collectionFilters : {},
    collectionOptions : {},
    allowView         : true,
    allowInsert       : true,
    allowUpdate       : true,
    allowDelete       : true,
    beforeView        : null,
    afterView         : null,
    beforeInsert      : null,
    afterInsert       : null,
    beforeUpdate      : null,
    afterUpdate       : null,
    beforeDelete      : null,
    afterDelete       : null
  };

  /**
   * @type {{collectionFilters: {}, collectionOptions: {}, allowView: boolean, allowInsert: boolean, allowUpdate: boolean, allowDelete: boolean, beforeView: null, afterView: null, beforeInsert: null, afterInsert: null, beforeUpdate: null, afterUpdate: null, beforeDelete: null, afterDelete: null}}
   */
  var settings = _.extend({}, defaultSettings, options || {});

  /**
   * Test for permission to perform action
   *
   * @param {string} action 'view','insert','update','delete'
   */
  function resolveAllowed(action) {
    if (['view', 'insert', 'update', 'delete'].indexOf(action.toLowerCase()) === -1) {
      return false;
    }

    var level = 'allow' + action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();

    if (typeof settings[level] === "function") {
      return settings[level]() === true;
    }
    else {
      return settings[level] === true;
    }
  }

  function doCallback(name, document) {
    if (!(typeof settings[name] === "function")) {
      return document;
    }

    return settings[name](document);
  }

  function resolveDocumentId(document, id) {
    var _id = document._id || id;

    if (/^[a-f0-9]$/i.test(_id) {
      document._id = new Meteor.Collection.ObjectID(_id);
    }
    else {
      document._id = _id;
    }

    return document;
  }

  function unwrapDocumentId(document) {
    if (document instanceof Array) {
      for (var index in document) {
        unwrapDocumentId(document[index]);
      }

      return document;
    }

    if (document && document._id && document._id._str) {
      document._id = document._id._str;
    }

    return document;
  }

  function handleCollectionRequest(params, request, response) {
    switch (request.method) {
      case 'GET':
        // list all documents

        if (!resolveAllowed('view')) {
          response.writeHead(401, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify("Unauthorized"));

          return;
        }

        var result = collection.find(
          _.extend({}, settings.collectionFilters),
          _.extend({}, settings.collectionOptions)
        ).fetch();

        unwrapDocumentId(result);

        result = doCallback('beforeView', result);

        if (result === false) {
          response.writeHead(401, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify("Unauthorized"));

          return;
        }

        response.writeHead(200, {'Content-Type' : 'application/json'});
        response.end(JSON.stringify(result));

        doCallback('afterView', result);
        break;
      case 'POST':
        // insert one document

        if (!resolveAllowed('insert')) {
          response.writeHead(401, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify("Unauthorized"));

          return;
        }

        var data = doCallback('beforeInsert', request.body);

        resolveDocumentId(data, null);

        if (data === false) {
          response.writeHead(401, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify("Unauthorized"));

          return;
        }

        collection.insert(data, function (error, id) {
          if (error) {
            response.writeHead(500, {'Content-Type' : 'application/json'});
            response.end(JSON.stringify(error));

            return;
          }

          var result = collection.findOne({_id : id});

          unwrapDocumentId(result);

          response.writeHead(200, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify(result));

          doCallback('afterInsert', result);
        });

        break;
    }
  }

  function handleDocumentRequest(params, request, response) {
    switch (request.method) {
      case 'GET':
        // get a document by id

        var filter = resolveDocumentId(_.extend({}, settings.collectionFilters, {_id : params._id}));

        console.log(filter, collection.findOne(filter));

        var result = doCallback('beforeView', unwrapDocumentId(collection.findOne(filter)));

        if (result === false) {
          response.writeHead(401, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify("Unauthorized"));

          return;
        }

        response.writeHead(200, {'Content-Type' : 'application/json'});
        response.end(JSON.stringify(result));

        doCallback('afterView', result);
        break;
      case 'POST':
      case 'PUT':
        // replace or insert a document by id

        var data = doCallback('beforeUpdate', request.body);

        if (data === false) {
          response.writeHead(401, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify("Unauthorized"));

          return;
        }

        resolveDocumentId(data, params._id);

        var filter = resolveDocumentId(_.extend({}, settings.collectionFilters, {_id : params._id}));

        collection.upsert(filter, data, function (error) {
          if (error) {
            response.writeHead(500, {'Content-Type' : 'application/json'});
            response.end(JSON.stringify(error));

            return;
          }

          var result = collection.findOne({_id : params._id});

          response.writeHead(200, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify(result));

          doCallback('afterUpdate', result);
        });

        break;
      case 'DELETE':
        // remove a document by id

        if (!doCallback('beforeDelete', params._id)) {
          response.writeHead(401, {'Content-Type' : 'application/json'});
          response.end(JSON.stringify("Unauthorized"));

          return;
        }

        var filter = resolveDocumentId(_.extend({}, settings.collectionFilters, {_id : params._id}));
        collection.remove(filter, function (error) {
          if (error) {
            response.writeHead(500, {'Content-Type' : 'application/json'});
            response.end(JSON.stringify(error));

            return;
          }

          response.writeHead(200, {'Content-Type' : 'application/json'});
          response.end();

          doCallback('afterDelete', params._id)
        });
        break;
      default:
        response.writeHead(501, {'Content-Type' : 'application/json'});
        response.end(JSON.stringify("Not Implemented"));
    }
  }

  this.handleRequest = function (params, request, response) {
    if (params._id === undefined) {
      handleCollectionRequest(params, request, response);
    }
    else {
      handleDocumentRequest(params, request, response);
    }
  };

};

var IronRestClass = function () {
  var self = this;
  var endpoints = {};

  /**
   * @type {{prefix: string, accessToken: string}}
   */
  var settings = {
    prefix : '/api',
    accessToken : ''
  };

  /**
   * @param {{prefix: string, accessToken: string}} options
   */
  this.configure = function (options) {
    _.extend(settings, options);
  };

  /**
   * Attach a collection to the REST router
   *
   * @param {string}            name        The name used to target the collection
   * @param {Meteor.Collection} collection  The collection itselt
   * @param {{collectionFilters: {}, collectionOptions: {}, allowView: boolean, allowInsert: boolean, allowUpdate: boolean, allowDelete: boolean, beforeView: null, afterView: null, beforeInsert: null, afterInsert: null, beforeUpdate: null, afterUpdate: null, beforeDelete: null, afterDelete: null}}   options  Attachment options
   *
   * Options:
   *   collectionFilters : {} // http://docs.meteor.com/#find supported selectors
   *   collectionOptions : {} // http://docs.meteor.com/#find supported options
   *   allowView         : true // boolean or function () { return true }
   *   allowInsert       : true // boolean or function () { return true }
   *   allowUpdate       : true // boolean or function () { return true }
   *   allowDelete       : true // boolean or function () { return true }
   *   beforeView        : null // function (documentOrList) { return documentOrList },
   *   afterView         : null // function (documentOrList) {},
   *   beforeInsert      : null // function (document) { return document },
   *   afterInsert       : null // function (document) {},
   *   beforeUpdate      : null // function (document) { return document },
   *   afterUpdate       : null // function (document) {},
   *   beforeDelete      : null // function (document) { return document },
   *   afterDelete       : null // function (document) {}
   */
  this.attach = function (name, collection, options) {
    endpoints[name] = new EndPoint(collection, options);
  };

  /**
   * Detach a collection from the REST router
   *
   * @param name
   */
  this.detach = function (name) {
    delete endpoints[name];
  };

  /**
   * Handle the incoming request
   *
   * @param params
   * @param request
   * @param response
   */
  function handleRequest(params, request, response) {
    var name = params.collection;

    if (!(endpoints[name] instanceof EndPoint)) {
      response.writeHead(404, {'Content-Type' : 'application/json'});
      response.end(JSON.stringify("Not Found"));

      return;
    }

    if (!request.headers['x-ironrest-auth-token'] || request.headers['x-ironrest-auth-token'] !== settings.accessToken) {
      response.writeHead(401, {'Content-Type' : 'application/json'});
      response.end(JSON.stringify("Unauthorized"));

      return;
    }

    endpoints[name].handleRequest(params, request, response);
  }

  /*
   * Attach the router
   */
  Router.map(function () {
    this.route('iron-rest', {
      where  : 'server',
      path   : settings.prefix + '/:collection/:_id?',
      action : function () {
        handleRequest(this.params, this.request, this.response);
      }
    });
  });
};

IronREST = new IronRestClass;
