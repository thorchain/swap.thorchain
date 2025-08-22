import * as gaia from './gaia'
import * as kujira from './kujira'
import * as noble from './noble'
import * as osmo from './osmo'
import * as thor from './thor'

export const main = [gaia.main, kujira.main, thor.main, osmo.main]
export const stage = [gaia.stage, kujira.stage, thor.stage, osmo.stage]
export const dev = [gaia.dev, kujira.dev, noble.dev, thor.dev, osmo.dev]
