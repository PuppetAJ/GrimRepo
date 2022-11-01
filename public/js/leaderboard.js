const gameState = document.location.search;
console.log(gameState);
const testEl = document.querySelector('#test');

if(gameState === '?loss') {
  testEl.textContent = 'loss';
} else if (gameState === '?win') {
  testEl.textContent = 'win'
}
