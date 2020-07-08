'use strict';

const pushToAirtable = require('./src/pushToAirtable');
// TODO: use clearer name in place of validate
const validate = require('./site-ingestion-schema/validator');

console.log('Loading site ingestion API');


// TODO: Update to handle events according to the CloudFlare Worker handlers
// addEventListener()
// https://developers.cloudflare.com/workers/tutorials/build-a-jamstack-app

// TODO: Simplify handlers by splitting into particular functions
exports.handler = async (event) => {
    console.log(`Request: ${JSON.stringify(event)}`);

    //TODO: Move validation closer to the response function
    if (event.path !== '/form-upload' && event.path !== '/upload-site') {
        return {
            statusCode: 404,
            body: JSON.stringify({
                error: 'Unsupported endpoint'
            })
        };
    }

    if (!event.body || Object.keys(event.body).length === 0) {
        return {
            statusCode: 400,
            body: JSON.stringify({
                error: 'Empty payload'
            })
        };
    }

    let sites;
    let body;
    try {
        body = JSON.parse(event.body);

        //TODO: use switch-case
        //TODO: add workaround for FormAssembly data
        if (event.path === '/form-upload') {
            sites = [body];
        } else if (event.path === '/upload-site') {
            if (!body.data || !Array.isArray(body.data) || body.data.length === 0) {
                return {
                    statusCode: 400,
                    body: JSON.stringify({
                        error: 'No data array provided'
                    })
                };
            }
            sites = body.data;
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
    const [isValid, errorMsg] = validate(sites);
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
