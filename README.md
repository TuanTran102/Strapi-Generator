# Strapi Generator

Generate Strapi modules from a MySQL database schema.

## Installation
```bash
npm install -D strapi-generator
```
## Setup

### 1. Create a `.env` file with the following variables:
```
SOURCE_DB_HOST=
SOURCE_DB_USER=
SOURCE_DB_PASSWORD=
SOURCE_DB_NAME=
SOURCE_DB_PORT=
SOURCE_DB_TABLE_PREFIX=
```
   - If you want to generate only the tables with the prefix, set `SOURCE_DB_TABLE_PREFIX`. Otherwise, the generator will generate all tables.
   - Example: `SOURCE_DB_TABLE_PREFIX=tbl_` will generate all tables with the prefix `tbl_`, such as `tbl_user`, `tbl_product`, etc.
  
### 2. Run the generator:
```bash
strapi-gen
```
or run by npm script
package.json
```json
"scripts": {
    "generate:modules": "strapi-gen"
}
```
```bash
npm run generate:modules
```