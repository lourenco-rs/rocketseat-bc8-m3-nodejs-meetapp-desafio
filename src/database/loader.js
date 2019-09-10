import Sequelize from 'sequelize';

import User from '../app/models/User';
import File from '../app/models/File';
import Meetup from '../app/models/Meetup';

import databaseConfig from '../config/database';

const models = [User, File, Meetup];

class Database {
  constructor() {
    this.connection = new Sequelize(databaseConfig);

    this.initModels();
    this.makeAssociations();
  }

  initModels() {
    models.forEach(model => model.init(this.connection));
  }

  makeAssociations() {
    models.forEach(model => {
      if (model.associate) {
        model.associate(this.connection.models);
      }
    });
  }
}

export default new Database();
