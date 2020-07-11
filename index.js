'use strict';

const pushToAirtable = require('./src/pushToAirtable');
const validateSchema = require('./site-ingestion-schema/validator');

console.log('Loading site ingestion API');


addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request));
});

const

const handleRequest = async (event) => {
    console.log(`Request: ${JSON.stringify(event)}`);

    let sites;
    let body;
    try {
        body = JSON.parse(event.body);

        //TODO: add endpoint for FormAssembly and Typeform data
        switch (event.path) {
          case '/form-upload':
            sites = [body];
          case '/upload-site':
            if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: 'No data array provided'
                    })
                };
            }
            sites = body.data;
          default:
            return {
              statusCode: 404,
              body: JSON.stringify({
                error: 'Unsupported endpoint'
              })
            };
        }
    } catch (e) {
        console.log(`Invalid payload: ${body}`);

        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'Invalid payload'
            })
        };
    }

    // check if sites conform to schema
    const [isValid, errorMsg] = validateSchema(sites);
    if (!isValid) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: errorMsg
            })
        };
    }

    // attempt to push to Airtable
    let sitesAdded; let siteDetailsAdded;
    let email; let password;
    try {
        email = await body.email;
        console.log('THE TEST PASSWORD LOOKS LIKE', email);
        password = await !!body.password ? body.password : null;
        [sitesAdded, siteDetailsAdded] = await pushToAirtable(sites, email, password);
    } catch (err) {
        console.log(err);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: `${err.name}: ${err.message}`
            })
        };
    }

    const response = {
        statusCode: 200,
        body: JSON.stringify({
            message: `Added ${sitesAdded} new sites and ${siteDetailsAdded} new site details`
        })
    };

    return response;
};
