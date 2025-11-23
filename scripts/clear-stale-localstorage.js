/**
 * Clear Stale LocalStorage Data
 *
 * This script provides instructions for clearing stale localStorage data
 * that may be causing incorrect processing status displays.
 *
 * Since localStorage is browser-based, this needs to be run in the browser console.
 */

console.log('🧹 Clear Stale LocalStorage Data')
console.log('=================================\n')
console.log('Run the following commands in your browser console (F12 / Developer Tools):')
console.log('')
console.log('// Clear video processing status')
console.log('localStorage.removeItem("videoProcessingStatus")')
console.log('')
console.log('// Clear dismissed banner state')
console.log('localStorage.removeItem("dismissedProcessingBanner")')
console.log('')
console.log('// Clear sync state')
console.log('localStorage.removeItem("syncState")')
console.log('')
console.log('// Or clear all localStorage (more aggressive)')
console.log('localStorage.clear()')
console.log('')
console.log('Then refresh the page to see the correct status.')
console.log('')
console.log('ℹ️  After clearing, the dashboard will fetch fresh data from the API.')
