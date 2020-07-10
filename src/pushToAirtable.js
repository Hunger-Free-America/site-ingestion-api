/**
 * Pushes data to Airtable Sites table, then push associated details to Site Details table.
 *
 * Dependant on password from CLI tool for /upload-site to not push the actual base rather than TEST.
 */
'use strict';

require('dotenv').config();
const Airtable = require('airtable');
const { populateSiteFields, populateDetailsFields } = require('../site-ingestion-schema/schema');

const updateMethod = 'Upload V4: github.com/COVID-basic-needs/site-ingestion-api';

module.exports = async (siteList, email, password) => {
    const base = new Airtable({
        apiKey: process.env.AIRTABLE_API_KEY
    }).base(password === process.env.PW ? process.env.AIRTABLE_BASE_ID : process.env.TEST_BASE_ID);

    const sitesTable = base(process.env.AIRTABLE_SITES_TABLE);
    const detailsTable = base(process.env.AIRTABLE_SITE_DETAILS);
    const preExistingSiteDetails = [];
    const newSites = [];
    let preExistingSitesCount = 0;
    let newDetailsCount = 0;

    console.log(`
Pulling Airtable Sites table to check if ready & clean, and to use for pre-existing sites details...`);

    let originalSites = await sitesTable.select({ fields: ['siteID'] }).all();

    console.log(`
Fetched ${Object.keys(originalSites).length} rows from the sites table. Checking if duplicates exist within Airtable itself...`);

    // Returns an object with keys:siteIDs & values:airtableRecordIDs
    originalSites = await originalSites.reduce((out, record, i) => {

        // Find if two originalSites have the same 'unique' identifier (see const siteID below)
        if (originalSites.findIndex(aRecord => aRecord.fields.siteID === record.fields.siteID) !== i) {
            throw new Error(`

************************ THE CURRENT AIRTABLE TABLE CONTAINS DUPLICATES WITHIN ITSELF!!! ************************

To prevent unintended consequences, remove existing duplicates in the Airtable Sites table before uploading new sites & site details.
`);
        }
        out[record.fields.siteID] = record.id;

        return out;
    }, {});

    console.log(`
Airtable is clean and ready. Checking if the provided data contains sites which already exist on Airtable...`);

    // Filter out siteDetails corresponding to pre-existing sites to upload separately
    siteList.forEach((site) => {

        // Generate the 'unique' site identifier w/ the same formula as Airtable
        const siteID = `${site.siteName} - ${site.siteStreetAddress || ''}, ${site.siteCity || ''} ${site.siteState || ''} ${site.siteZip || ''}`;
        if (originalSites[siteID]) {
            preExistingSitesCount += 1;

            // On pre-existing sites with non-empty details, add site details (with Site's record id) to preExistingSiteDetails array
            if (site.hasDetails) {
                const details = populateDetailsFields(site, originalSites[siteID], email, updateMethod);
                preExistingSiteDetails.push(details);
            }
        } else {
            newSites.push(site);
        }
    });

    console.log(`
The provided data contains ${preExistingSitesCount} pre-existing sites and ${preExistingSiteDetails.length} valid details for them. Now uploading those details..`);

    /**
     * Push details corresponded to pre-existing sites.
     *
     * Airtable's create API only allows 10 at a time, so we batch.
     * Their API's rate limit is an issue so we use await inside the loop to slow it down.
     */
    for (let i = 0; i < preExistingSiteDetails.length; i += 10) {
        try {
            const batch = preExistingSiteDetails.slice(i, i + 10 < preExistingSiteDetails.length ? i + 10 : preExistingSiteDetails.length);
            if (batch.length) await detailsTable.create(batch, { typecast: true });
            if (i && i % 100 === 0 || i === preExistingSiteDetails.length) console.log(`
Created ${i} of ${preExistingSiteDetails.length} preExistingSiteDetails`);
        } catch (err) {
            console.error(`
Error creating preExistingSiteDetails`);
            throw err;
        }
    }

    console.log(`
Uploaded ${preExistingSiteDetails.length} new details for pre-existing sites. Now uploading new sites...`);

    /**
     * Push new sites.
     *
     * Airtable's create API only allows 10 at a time, so we batch.
     * Their API's rate limit is an issue so we use await inside the loop to slow it down.
     */
    for (let i = 0; i < newSites.length; i += 10) {
        const tenSites = newSites.slice(i, i + 10 < newSites.length ? i + 10 : newSites.length);
        const tenSiteLocations = tenSites.map((site) => populateSiteFields(site, email, updateMethod));
        try {

            // Push 10 Sites to Airtable & use resultant Airtable record IDs to populate & push siteDetails objects
            await sitesTable.create(tenSiteLocations, { typecast: true }).then(async records => {
                try {

                    // Create the 10 siteDetails objects with corresponding Site record IDs
                    const tenSiteDetails = records.reduce((out, record, j) => {

                        // Skip uploading details on sites where there are none
                        if (tenSites[j].hasDetails) {
                            const details = populateDetailsFields(tenSites[j], record.id, email, updateMethod);
                            out.push(details);
                            newDetailsCount += 1;
                        }

                        return out;
                    }, []);
                    if (tenSiteDetails.length) await detailsTable.create(tenSiteDetails, { typecast: true });
                    if (i && i % 100 === 0 || i === newSites.length) console.log(`
Created ${i} of ${newSites.length} new Sites and ${newDetailsCount} new site Details`);
                } catch (err) {
                    console.error(`
Error creating new siteDetails`);
                    throw err;
                }
            });
        } catch (err) {
            console.error(`
Error creating new Sites:

    ${err.message}
`);
            throw err;
        }
    }

    console.log(`
Created ${newSites.length} new Sites + ${newDetailsCount} new relevant details.`);
};
