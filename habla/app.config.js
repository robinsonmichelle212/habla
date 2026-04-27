const appJson = require('./app.json');

module.exports = {
  ...appJson,
  extra: {
    eas: {
      projectId: "fdb91ef8-4e14-4daf-959e-5459a00359c3"
    }
  }
};