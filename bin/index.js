#!/usr/bin/env node

const StrapiGenerator  = require('../src/generate');
const generator = new StrapiGenerator();
generator.generateModules()
  .then(() => {
    console.log('Generation complete!');
  })
  .catch((err) => {
    console.error('Error generating modules:', err);
  });
