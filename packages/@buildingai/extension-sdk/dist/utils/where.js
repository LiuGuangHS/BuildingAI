"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDefinedWhere = buildDefinedWhere;
function buildDefinedWhere(values) {
    return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}
