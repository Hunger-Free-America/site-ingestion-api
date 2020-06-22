'use strict';

const newlines = /[\n]+/g;
const spaces = /[\s]+/g;
const leadingPunc = /^[^a-zA-Z0-9]+/;
const trailingPunc = /[^a-zA-Z0-9]+$/;
const spacePeriod = /[\s]+,/g;
const dashes = /\u2013|\u2014/g;

const cleanField = (field) => {
    // multiple newlines
    return field.replace(newlines, ', ')
        // multiple spaces
        .replace(spaces, ' ')
        // space before period
        .replace(spacePeriod, ',')
        // leading/trailing punctuation
        .replace(leadingPunc, '')
        .replace(trailingPunc, '')
        // fix dashes
        .replace(dashes, '-');
};

module.exports = (site) => {
    return Object.entries(site).reduce((out, [k, v]) => (v ? (out[k] = cleanField(v), out) : out), {});
};
