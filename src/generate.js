const path = require('path');
const fs = require('fs-extra');
const mysql = require('mysql2/promise');

/**
 * StrapiGenerator
 *
 * Generate Strapi modules and tables from DB schema.
 *
 * @class StrapiGenerator
 */
class StrapiGenerator {
  /**
   * Constructor
   *
   * @constructor
   */
  constructor() {
    this.sourceDbConfig = {
      host: process.env.SOURCE_DB_HOST || 'localhost',
      user: process.env.SOURCE_DB_USER || 'root',
      password: process.env.SOURCE_DB_PASSWORD || '',
      database: process.env.SOURCE_DB_NAME || 'restaurant',
      port: process.env.SOURCE_DB_PORT || 3306,
    };
    this.tablePrefix = process.env.SOURCE_DB_TABLE_PREFIX || 'tbl';
    this.excludedFields = ['id', 'created_at', 'updated_at', 'published_at', 'locale', 'created_by_id', 'updated_by_id', 'document_id'];
  }

  /**
   * Converts underscore notation to kebab case
   *
   * @param {string} str
   * @returns {string}
   */
  toKebabCase(str) {
    return str.replace(/_/g, '-').toLowerCase();
  }

  /**
   * Maps MySQL data type to Strapi data type
   *
   * @param {string} dataType
   * @returns {string}
   */
  mapDataTypeToStrapi(dataType) {
    const typeMapping = {
      int: 'integer',
      bigint: 'biginteger',
      varchar: 'string',
      text: 'text',
      datetime: 'datetime',
      date: 'date',
      tinyint: 'boolean',
      decimal: 'float',
      double: 'float',
      float: 'float',
    };
    return typeMapping[dataType] || 'string';
  }

  /**
   * Gets database schema
   *
   * @returns {object}
   */
  async getDatabaseSchema() {
    const connection = await mysql.createConnection(this.sourceDbConfig);
    const [rows] = await connection.query(`
      SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${this.sourceDbConfig.database}';
    `);
    await connection.end();

    const schema = {};
    rows.forEach(({ TABLE_NAME, COLUMN_NAME, DATA_TYPE, IS_NULLABLE }) => {
      if (TABLE_NAME.startsWith(this.tablePrefix)) {
        if (!schema[TABLE_NAME]) schema[TABLE_NAME] = [];
        schema[TABLE_NAME].push({
          name: COLUMN_NAME,
          type: DATA_TYPE,
          required: IS_NULLABLE === 'NO',
        });
      }
    });
    return schema;
  }

  /**
   * Creates a content type
   *
   * @param {string} tableName
   * @param {object[]} attributes
   */
  async createContentType(tableName, attributes) {
    const singularName = this.toKebabCase(tableName);
    const basePath = path.join(process.cwd(), 'src/api', singularName);
    const contentTypePath = path.join(basePath, 'content-types', singularName);

    await fs.ensureDir(contentTypePath);

    const filteredAttributes = attributes.filter(attr => !this.excludedFields.includes(attr.name));

    const contentType = {
      kind: 'collectionType',
      collectionName: tableName,
      info: {
        singularName,
        pluralName: `${singularName}s`,
        displayName: singularName.charAt(0).toUpperCase() + singularName.slice(1),
        description: ""
      },
      pluginOptions: {},
      options: {
        draftAndPublish: true,
      },
      attributes: filteredAttributes.reduce((acc, { name, type, required }) => {
        acc[name] = { type: this.mapDataTypeToStrapi(type) };
        if (required) acc[name].required = true;
        return acc;
      }, {}),
    };

    await fs.writeJson(
      path.join(contentTypePath, 'schema.json'),
      contentType,
      { spaces: 2 }
    );

    console.log(`Content type for "${tableName}" created.`);
  }

  /**
   * Creates a controller
   *
   * @param {string} tableName
   */
  async createController(tableName) {
    const singularName = this.toKebabCase(tableName);
    const basePath = path.join(process.cwd(), 'src/api', singularName);
    const controllerPath = path.join(basePath, 'controllers');

    await fs.ensureDir(controllerPath);

    const controllerData = `
      /**
       * ${singularName} controller
       */

      import { factories } from '@strapi/strapi'

      export default factories.createCoreController('api::${singularName}.${singularName}');
    `;
    await fs.writeFile(
      path.join(controllerPath, `${singularName}.ts`),
      controllerData
    );

    console.log(`Controller for "${tableName}" created.`);
  }

  /**
   * Creates a service
   *
   * @param {string} tableName
   */
  async createService(tableName) {
    const singularName = this.toKebabCase(tableName);
    const basePath = path.join(process.cwd(), 'src/api', singularName);
    const servicePath = path.join(basePath, 'services');

    await fs.ensureDir(servicePath);

    const serviceData = `
      /**
       * ${singularName} service
       */

      import { factories } from '@strapi/strapi'

      export default factories.createCoreService('api::${singularName}.${singularName}');
    `;
    await fs.writeFile(
      path.join(servicePath, `${singularName}.ts`),
      serviceData
    );

    console.log(`Service for "${tableName}" created.`);
  }

  /**
   * Creates a route
   *
   * @param {string} tableName
   */
  async createRoute(tableName) {
    const singularName = this.toKebabCase(tableName);
    const basePath = path.join(process.cwd(), 'src/api', singularName);
    const routePath = path.join(basePath, 'routes');

    await fs.ensureDir(routePath);

    const routeData = `
      /**
       * ${singularName} router
       */

      import { factories } from '@strapi/strapi'

      export default factories.createCoreRouter('api::${singularName}.${singularName}');
    `;
    await fs.writeFile(
      path.join(routePath, `${singularName}.ts`),
      routeData
    );

    console.log(`Route for "${tableName}" created.`);
  }

  /**
   * Generates all modules
   */
  async generateModules() {
    const schema = await this.getDatabaseSchema();

    for (const [tableName, attributes] of Object.entries(schema)) {
      await this.createContentType(tableName, attributes);
      await this.createController(tableName);
      await this.createService(tableName);
      await this.createRoute(tableName);
    }

    console.log('Modules generated successfully.');
  }
}

module.exports = StrapiGenerator;

