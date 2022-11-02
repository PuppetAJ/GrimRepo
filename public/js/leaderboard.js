const gameState = document.location.search;
const messageEl = document.querySelector('#message');
const buttonEl = document.querySelector('.btn');

if(gameState === '?loss') {
  messageEl.textContent = 'You lost ):';
} else if (gameState === '?win') {
  messageEl.textContent = 'You win!'
}

buttonEl.addEventListener('click', () => {
  document.location.replace('/');
});