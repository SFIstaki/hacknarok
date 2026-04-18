import assert from 'node:assert/strict'
import { FocusStateClassifier } from '../classifier'
import type { FocusState } from '../types'

function main(): void {
  const classifier = new FocusStateClassifier()
  const base = Date.now()

  for (let i = 0; i < 12; i += 1) {
    classifier.update({
      ts: base + i * 5_000,
      mouseDeltaPx: 20,
      appName: 'Visual Studio Code',
      windowTitle: 'presently'
    })
  }

  const locked = classifier.update({
    ts: base + 13 * 5_000,
    mouseDeltaPx: 18,
    appName: 'Visual Studio Code',
    windowTitle: 'presently'
  })
  assert.equal(locked.state, 'locked', 'Expected locked for stable window + active mouse')

  let fadingState: FocusState = locked.state
  const switchingTitles = ['Tab 1', 'Tab 2', 'Tab 3', 'Tab 4', 'Tab 5']

  for (let i = 0; i < switchingTitles.length; i += 1) {
    fadingState = classifier.update({
      ts: base + (20 + i) * 5_000,
      mouseDeltaPx: 20,
      appName: 'Google Chrome',
      windowTitle: switchingTitles[i]
    }).state
  }

  assert.equal(fadingState, 'fading', 'Expected fading for frequent window/title switches')

  let goneState: FocusState = fadingState
  for (let i = 0; i < 14; i += 1) {
    goneState = classifier.update({
      ts: base + (40 + i) * 5_000,
      mouseDeltaPx: 0,
      appName: 'Google Chrome',
      windowTitle: 'Idle'
    }).state
  }

  assert.equal(goneState, 'gone', 'Expected gone after inactivity')

  console.log('Classifier test passed ✅')
}

main()
