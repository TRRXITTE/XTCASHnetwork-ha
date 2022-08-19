// Copyright (c) 2018-2019, Brandon Lehmann, The TurtCoin Developers
//
// Please see the included LICENSE file for more information.

'use strict'

const XTCASHnetwork = require('./')
const util = require('util')

const metrics = []
try {
  const pm2Metrics = require('@pm2/io')

  log('@pm2/io module installed, enabling custom metrics...')

  const metricSet = [
    { name: 'Status', unit: false },
    { name: 'Progress', unit: 'percent' },
    { name: 'Blockheight', unit: 'blocks' },
    { name: 'Net hash', unit: 'h/s' },
    { name: 'Difficulty', unit: false }
  ]

  metricSet.forEach((metric) => {
    metrics.push(pm2Metrics.metric({
      name: metric.name,
      unit: metric.unit
    }))
  })
} catch (error) {
  log('@pm2/io module not installed, ignoring...')
}

var daemon = new XTCASHnetwork({
  loadCheckpoints: './checkpoints.csv'
  // Load additional daemon parameters here
})

function log (message) {
  console.log(util.format('%s: %s', (new Date()).toUTCString(), message))
}

function resetMetrics (metrics) {
  metrics.forEach((metric) => {
    metric.set(undefined)
  })
}

daemon.on('start', (args) => {
  log(util.format('XTCASHnetwork has started... %s', args))
  if (metrics.length !== 0) {
    resetMetrics(metrics)
    metrics[0].set('starting')
  }
})

daemon.on('started', () => {
  log('XTCASHnetwork is attempting to synchronize with the network...')
  if (metrics.length !== 0) {
    resetMetrics(metrics)
    metrics[0].set('started')
  }
})

daemon.on('syncing', (info) => {
  log(util.format('XTCASHnetwork has synchronized %s out of %s blocks [%s%]', info.height, info.network_height, info.percent))
  if (metrics.length !== 0) {
    resetMetrics(metrics)
    metrics[0].set('synchronizing')
    metrics[1].set(`${info.height}/${info.network_height} (${info.percent}%)`)
  }
})

daemon.on('synced', () => {
  log('XTCASHnetwork is synchronized with the network...')
  if (metrics.length !== 0) {
    resetMetrics(metrics)
    metrics[0].set('synchronized')
  }
})

daemon.on('ready', (info) => {
  log(util.format('XTCASHnetwork is waiting for connections at %s @ %s - %s H/s', info.height, info.difficulty, info.globalHashRate))
  if (metrics.length !== 0) {
    metrics[0].set('waiting for connections')
    metrics[2].set(info.height)
    metrics[3].set(info.globalHashRate)
    metrics[4].set(info.difficulty)
  }
})

daemon.on('desync', (daemon, network, deviance) => {
  log(util.format('XTCASHnetwork is currently off the blockchain by %s blocks. Network: %s  Daemon: %s', deviance, network, daemon))
  if (metrics.length !== 0) {
    resetMetrics(metrics)
    metrics[0].set('desynchronized')
    metrics[1].set(`${daemon}/${network}`)
  }
})

daemon.on('down', () => {
  log('XTCASHnetwork is not responding... stopping process...')
  if (metrics.length !== 0) {
    resetMetrics(metrics)
    metrics[0].set('down')
  }
  daemon.stop()
})

daemon.on('stopped', (exitcode) => {
  log(util.format('XTCASHnetwork has closed (exitcode: %s)... restarting process...', exitcode))
  if (metrics.length !== 0) {
    resetMetrics(metrics)
    metrics[0].set(`stopped (code: ${exitcode})`)
  }
  daemon.start()
})

daemon.on('info', (info) => {
  log(info)
})

daemon.on('error', (err) => {
  log(err)
})

daemon.start()
