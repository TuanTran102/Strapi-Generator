#!/usr/bin/env node

const StrapiGenerator  = require('../src/generate');
const generator = new StrapiGenerator();
console.log('Starting generate...');
generator.generateModules()
  .then(() => {
    console.log('Generation complete!');
  })
  .catch((err) => {
    console.error('Error generating modules:', err);
  });
