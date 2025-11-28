/**
 * Debug Banner State
 *
 * Copy and paste this into the browser console while viewing Lance's dashboard
 * to see what data the VideoProcessingBanner component is reading.
 */

console.log('🔍 Debugging VideoProcessingBanner State\n');
console.log('========================================\n');

// Check localStorage
console.log('📦 LocalStorage Data:');
console.log('---------------------');

const videoProcessingStatus = localStorage.getItem('videoProcessingStatus');
if (videoProcessingStatus) {
  console.log('❌ Found videoProcessingStatus:');
  try {
    const parsed = JSON.parse(videoProcessingStatus);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('   (Invalid JSON)', videoProcessingStatus);
  }
} else {
  console.log('✅ No videoProcessingStatus in localStorage');
}

const dismissedBanner = localStorage.getItem('dismissedProcessingBanner');
console.log(`${dismissedBanner ? '❌' : '✅'} dismissedProcessingBanner:`, dismissedBanner || 'not set');

const syncState = localStorage.getItem('syncState');
if (syncState) {
  console.log('❌ Found syncState:');
  try {
    const parsed = JSON.parse(syncState);
    console.log(JSON.stringify(parsed, null, 2));
  } catch (e) {
    console.log('   (Invalid JSON)', syncState);
  }
} else {
  console.log('✅ No syncState in localStorage');
}

console.log('\n🧹 To clear all stale data, run:');
console.log('---------------------');
console.log('localStorage.removeItem("videoProcessingStatus")');
console.log('localStorage.removeItem("dismissedProcessingBanner")');
console.log('localStorage.removeItem("syncState")');
console.log('location.reload()');
