/*
================== 
Element selectors
==================
*/

const gameState = document.location.search;
const messageEl = document.querySelector('#message');
const buttonEl = document.querySelector('.btn');

/* 
=========================
Logic and event listeners
=========================
*/

// Logic for displaying win / loss message to page

if(gameState === '?loss') {
  messageEl.textContent = 'You lost ):';
} else if (gameState === '?win') {
  messageEl.textContent = 'You win!'
}

// Event listener for home button

buttonEl.addEventListener('click', () => {
  document.location.replace('/');
});