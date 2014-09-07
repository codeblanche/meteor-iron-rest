Package.describe({
  summary: "A REST implementation using iron:router",
  version: "0.1.1-alpha",
  git: "https://github.com/CodeBlanche/meteor-iron-rest.git"
});

Package.onUse(function(api) {
  api.versionsFrom('METEOR@0.9.0.1');

  api.use('underscore', 'server');
  api.use('iron:router', ['client','server']);

  api.addFiles('src/iron-rest.js', 'server');

  api.export('IronREST', ['server']);
});

Package.onTest(function(api) {
  api.use('tinytest');
  api.use('mertenvg:iron-rest');

  api.addFiles('tests/iron-rest-tests.js');
});
