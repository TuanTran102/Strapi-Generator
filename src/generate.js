const path = require('path');
const fs = require('fs-extra');
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
dotenv.config();

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
      database: process.env.SOURCE_DB_NAME || 'strapi',
      port: process.env.SOURCE_DB_PORT || 3306,
    };
    this.tablePrefix = process.env.SOURCE_DB_TABLE_PREFIX || '';
    this.excludedFields = ['id', 'created_at', 'updated_at', 'published_at', 'locale', 'created_by_id', 'updated_by_id', 'document_id'];
    this.typeMapping = {
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
    return this.typeMapping[dataType] || 'string';
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
   * Creates a file from template
   * 
   * @param {string} basePath 
   * @param {string} fileName 
   * @param {string} content 
   */
  async createFile(basePath, fileName, content) {
    await fs.ensureDir(basePath);
    await fs.writeFile(path.join(basePath, fileName), content);
  }

  /**
   * Get module base information
   * 
   * @param {string} tableName 
   * @returns {object}
   */
  getModuleInfo(tableName) {
    const singularName = this.toKebabCase(tableName.replace(this.tablePrefix, ''));
    const basePath = path.join(process.cwd(), 'src/api', singularName);
    return { singularName, basePath };
  }

  /**
   * Creates a content type
   *
   * @param {string} tableName
   * @param {object[]} attributes
   */
  async createContentType(tableName, attributes) {
    const { singularName, basePath } = this.getModuleInfo(tableName);
    const contentTypePath = path.join(basePath, 'content-types', singularName);
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

    await fs.ensureDir(contentTypePath);
    await fs.writeJson(path.join(contentTypePath, 'schema.json'), contentType, { spaces: 2 });
    console.log(`Content type for "${tableName}" created.`);
  }

  /**
   * Creates a module file (controller, service, or route)
   *
   * @param {string} tableName
   * @param {string} type
   */
  async createModuleFile(tableName, type) {
    const { singularName, basePath } = this.getModuleInfo(tableName);
    const folderPath = path.join(basePath, `${type}s`);
    switch (type) {
      case 'route':
        type = 'router';
        break;
    }
    const fileContent = `
      /**
       * ${singularName} ${type}
       */

      import { factories } from '@strapi/strapi'

      export default factories.createCore${type.charAt(0).toUpperCase() + type.slice(1)}('api::${singularName}.${singularName}');
    `;

    await this.createFile(folderPath, `${singularName}.ts`, fileContent);
    console.log(`${type} for "${tableName}" created.`);
  }

  /**
   * Generates all modules
   */
  async generateModules() {
    const schema = await this.getDatabaseSchema();

    for (const [tableName, attributes] of Object.entries(schema)) {
      await this.createContentType(tableName, attributes);
      await this.createModuleFile(tableName, 'controller');
      await this.createModuleFile(tableName, 'service');
      await this.createModuleFile(tableName, 'route');
    }

    console.log('Modules generated successfully.');
  }
}

module.exports = StrapiGenerator;