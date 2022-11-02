// ======================
//    General Imports
// ======================

// ---Imports for GSAP and Three.js---
import * as THREE from 'three';
import {GLTFLoader} from 'GLTFLoader';
import {gsap} from 'GSAP';
import {TextGeometry} from 'TextGeometry';
import {FontLoader} from 'FontLoader';

// ---Orbit Controls import if needed---
// import {OrbitControls} from 'OrbitControls';

// =================================
//    Global variable declarations
// =================================

// --- Health overlay elements ---
var heart5 = document.getElementById("5")
var heart4 = document.getElementById("4")
var heart3 = document.getElementById("3")
var heart2 = document.getElementById("2")
var heart1 = document.getElementById("1")
var oppheart5 = document.getElementById("oh5")
var oppheart4 = document.getElementById("oh4")
var oppheart3 = document.getElementById("oh3")
var oppheart2 = document.getElementById("oh2")
var oppheart1 = document.getElementById("oh1")

// --- Boardstate hash map (keeps track of all spots) --- 
let boardState = new Map();

// -- Player squares --
boardState.set('p1', "");
boardState.set('p2', "");
boardState.set('p3', "");
boardState.set('p4', "");

// -- AI back squares, emulates their hand --
boardState.set('AIB1', "");
boardState.set('AIB2', "");
boardState.set('AIB3', "");
boardState.set('AIB4', "");

// -- AI attack squares --
boardState.set('AIF1', "");
boardState.set('AIF2', "");
boardState.set('AIF3', "");
boardState.set('AIF4', "");

// -- Health variables (50 for each) --
let AIHealth = 50;
let playerHealth = 50;

// -- Three.js variables --
let sacrificeCnt = 0;
var clock = new THREE.Clock();
var time = 0;
let obj, mixer, deck

// -- Game variables --
let viewToggle = false;
let selectedCardHand;
let cardArr = [];
let initialPass = false;
let turn = 0;
let drawCount = 0;
let cards = [
  'BootStrapped','BrokenCode','Bug','Cookie','DeathNode','destroyEnemy(you)','Documentation','Firewall','Gitbasher','GitSome','GoogleFu','GrimRepo','Hello World','if(losing)','Iterator','JACK','JSONFoorhees','Loop','NullPointer','OffCenterDiv','RobloxDevOps','RubberDuck','SQLSyntaxErr','Syntax Err'
];
let noCostCards = ['OffCenterDiv', 'Hello World', 'Syntax Err', 'Loop', 'if(losing)', 'RobloxDevOps','GoogleFu','GitSome','GrimRepo']
// We don't want the opponent to use 404 
// (404's feature is not yet implemented, but it was meant to clear the whole board.. so it'd be unfair to allow the AI to randomly pull it)
let oppCards = structuredClone(cards);
cards.push('FourOhFour');

// =============================
//    Three.js initialization
// =============================

// -- Fontloader for loading text to the page --
const fontLoader = new FontLoader();

// -- Loading manager for loading screen --
const loadingManager = new THREE.LoadingManager();

// -- Scene initialization --
const scene = new THREE.Scene();

// -- Grid helper (displays grid on scene) --
const gridHelper = new THREE.GridHelper( 100, 100 );
scene.add(gridHelper);

// -- Camera initialization (What player sees) --
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
// -- Allows camera to see objects on layer 2 --
camera.layers.enable(2);

// -- Renderer initialization --
const renderer = new THREE.WebGL1Renderer({
  canvas: document.querySelector('#bg'),
  antialias: true
});

// -- Raycaster initialization --
const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

// -- Renderer properties --
renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight);
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0.0);

// -- Camera positioning --
camera.position.setX(-2);
camera.position.setY(8.5);
camera.position.setZ(-5);

// -- Render scene --
renderer.render( scene, camera );

// -- Loading screen and other logic on page load --
loadingManager.onLoad = async function() {
  // Since we're constantly loading new models as cards, we need to detect if this is our first pass 
  if(initialPass === false) {
    // If it is, then deal the initial hand to the player. Otherwise, it won't be able to pull from the deck obj since it hasn't loaded in yet
    initialHand();
    // Set initial pass to true so that when other elements are loaded, this logic doesn't run
    initialPass = true;
    // Sets loading screen to fade out
    const loadingScreen = document.getElementById( 'loading-screen' );
    loadingScreen.classList.add( 'fade-out' );
  }
}

// -- GLTFLoader initialization (for using models made in blender) --
const loader = new GLTFLoader(loadingManager);

// -- OrbitControls for debugging --
//const controls = new OrbitControls(camera, renderer.domElement);

// ==============================
//    3D models loading section
//            (GLTF)
// ==============================

// -- Imports the house the game takes place in (model found on sketchfab) --
// Fantasy interior items by Tedium Interactive
// https://sketchfab.com/3d-models/fantasy-interior-items-6542c39c66394888994d7343fd03fdef
loader.load(
  './assets/models/house.glb', 
  function ( gltf ) {
    // Allows us to position and scale the object, as well as some other settings
    obj = gltf.scene;
    obj.castShadow = true;
    obj.scale.set(20,20,20);
    // Add object to scene
    scene.add(obj);
}, undefined, function (error) {
  console.error(error);
}
);

// -- Imports the robot model (Credits to inscryption, it is P03) --
// Animations by Adrian Jimenez
loader.load(
  './assets/models/robot.glb', 
  function ( gltf ) {
    obj = gltf.scene;
    // Object settings
    obj.castShadow = true;
    obj.scale.set(100,100,100);
    obj.position.setZ(-10);
    obj.position.setX(-2);
    obj.position.setY(2);
    obj.rotation.set(0,3.1,0);

    // Instantiate AnimationMixer using robot's animations
    mixer = new THREE.AnimationMixer(gltf.scene);
    const clips = gltf.animations;
    const clip = THREE.AnimationClip.findByName( clips, 'ArmatureAction' );
    // Plays animations when mixer is updated
    const action = mixer.clipAction(clip);
    action.play();
    clips.forEach( function (clip) {
     mixer.clipAction(clip).play();
    })
    // Add object to scene
    scene.add(obj);

}, undefined, function (error) {
  console.error(error);
}
);

// -- Imports game board (made by Adrian Jimenez (me)) --
loader.load(
  './assets/models/game_board.glb', 
  function ( gltf ) {
    obj = gltf.scene;
    // Object settings
    obj.castShadow = true;
    obj.scale.set(0.02,0.02,0.02);
    obj.position.setZ(-10);
    obj.position.setX(-1.6);
    obj.position.setY(6.9785);
    obj.rotation.set(3.15,3.15,0);
    // Add object to scene
    scene.add(obj);

}, undefined, function (error) {
  console.error(error);
}
)

// -- Imports deck model, made by me using inscryption assets for textures
// -- Load deck function for reshuffling later on --
const loadDeck = () => {
  loader.load(
    './assets/models/deck.glb', 
    function ( gltf ) {
      obj = gltf.scene;
      deck = gltf;
      // Object settings
      obj.castShadow = true;
      obj.scale.set(0.017,0.017,0.017);
      obj.position.setZ(-8.8);
      obj.position.setX(0.5);
      obj.position.setY(6.993);
      obj.rotation.set(-3.15,0,-3.15);
      // Add object to scene
      scene.add(obj);
  }, undefined, function (error) {
    console.error(error);
  }
  )
};

// Call loadDeck function to load the deck on page load
loadDeck();

// -- Loads bell model -- 
// Credits: https://sketchfab.com/3d-models/table-bell-77f2ea17b4c84fe1a8d2aec02caa9de3
// Edited by me
loader.load(
  './assets/models/bell.glb', 
  function ( gltf ) {
    obj = gltf.scene;
    // Object settings
    obj.castShadow = true;
    obj.scale.set(0.01,0.01,0.01);
    obj.position.setZ(-8.8);
    obj.position.setX(-4.4);
    obj.position.setY(6.993);
    obj.rotation.set(-3.15,0,-3.15);
    // Add object to scene
    scene.add(obj);

}, undefined, function (error) {
  console.error(error);
}
);

// ===========================
//       Lights in scene
// ===========================

// ambientLight to light up the whole room a small amount
const ambientLight = new THREE.AmbientLight(0xffaa33, 0.1);
// handLight for being able to see read cards
const handLight = new THREE.PointLight(0xffaa33, 1, 9);
handLight.position.set(-2, 8.5 -5);

// Add lights to scene
scene.add(handLight);
scene.add(ambientLight);

// Candle shaders
// Source: https://discourse.threejs.org/t/the-lonely-candle/4097
// Credits to prisoner849 from the three.js forums and all others he credited
function getFlameMaterial(isFrontSide){
  let side = isFrontSide ? THREE.FrontSide : THREE.BackSide;
  return new THREE.ShaderMaterial({
    uniforms: {
      time: {value: 0}
    },
    vertexShader: `
      uniform float time;
      varying vec2 vUv;
      varying float hValue;

      //https://thebookofshaders.com/11/
      // 2D Random
      float random (in vec2 st) {
          return fract(sin(dot(st.xy,
                               vec2(12.9898,78.233)))
                       * 43758.5453123);
      }

      // 2D Noise based on Morgan McGuire @morgan3d
      // https://www.shadertoy.com/view/4dS3Wd
      float noise (in vec2 st) {
          vec2 i = floor(st);
          vec2 f = fract(st);

          // Four corners in 2D of a tile
          float a = random(i);
          float b = random(i + vec2(1.0, 0.0));
          float c = random(i + vec2(0.0, 1.0));
          float d = random(i + vec2(1.0, 1.0));

          // Smooth Interpolation

          // Cubic Hermine Curve.  Same as SmoothStep()
          vec2 u = f*f*(3.0-2.0*f);
          // u = smoothstep(0.,1.,f);

          // Mix 4 coorners percentages
          return mix(a, b, u.x) +
                  (c - a)* u.y * (1.0 - u.x) +
                  (d - b) * u.x * u.y;
      }

      void main() {
        vUv = uv;
        vec3 pos = position;

        pos *= vec3(0.8, 2, 0.725);
        hValue = position.y;
        //float sinT = sin(time * 2.) * 0.5 + 0.5;
        float posXZlen = length(position.xz);

        pos.y *= 1. + (cos((posXZlen + 0.25) * 3.1415926) * 0.25 + noise(vec2(0, time)) * 0.125 + noise(vec2(position.x + time, position.z + time)) * 0.5) * position.y; // flame height

        pos.x += noise(vec2(time * 2., (position.y - time) * 4.0)) * hValue * 0.0312; // flame trembling
        pos.z += noise(vec2((position.y - time) * 4.0, time * 2.)) * hValue * 0.0312; // flame trembling

        gl_Position = projectionMatrix * modelViewMatrix * vec4(pos,1.0);
      }
    `,
    fragmentShader: `
      varying float hValue;
      varying vec2 vUv;

      // honestly stolen from https://www.shadertoy.com/view/4dsSzr
      vec3 heatmapGradient(float t) {
        return clamp((pow(t, 1.5) * 0.8 + 0.2) * vec3(smoothstep(0.0, 0.35, t) + t * 0.5, smoothstep(0.5, 1.0, t), max(1.0 - t * 1.7, t * 7.0 - 6.0)), 0.0, 1.0);
      }

      void main() {
        float v = abs(smoothstep(0.0, 0.4, hValue) - 1.);
        float alpha = (1. - v) * 0.99; // bottom transparency
        alpha -= 1. - smoothstep(1.0, 0.97, hValue); // tip transparency
        gl_FragColor = vec4(heatmapGradient(smoothstep(0.0, 0.3, hValue)) * vec3(0.95,0.95,0.4), alpha) ;
        gl_FragColor.rgb = mix(vec3(0,0,1), gl_FragColor.rgb, smoothstep(0.0, 0.3, hValue)); // blueish for bottom
        gl_FragColor.rgb += vec3(1, 0.9, 0.5) * (1.25 - vUv.y); // make the midst brighter
        gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(0.66, 0.32, 0.03), smoothstep(0.95, 1., hValue)); // tip
      }
    `,
    transparent: true,
    side: side
  });
};

// -- Candle lights and their settings --
// Source: https://discourse.threejs.org/t/the-lonely-candle/4097
// Credits to prisoner849 from the three.js forums
// Minor edits by me
var candleLight = new THREE.PointLight(0xffaa33, 6, 5, 2);
candleLight.position.set(-6, 9, -12.6);
candleLight.castShadow = true; 
candleLight.scale.set(0.1,0.1,0.1);
scene.add(candleLight);
var candleLight2 = new THREE.PointLight(0xffaa33, 1, 13, 2);
candleLight2.position.set(-5, 10, -12.6);
candleLight2.castShadow = true;
candleLight2.scale.set(0.1,0.1,0.1);
scene.add(candleLight2);

// -- Candle light geometry and shader application --
// Source: https://discourse.threejs.org/t/the-lonely-candle/4097
// Credits to prisoner849 from the three.js forums
// Minor edits by me
var flameMaterials = [];
function flame(isFrontSide){
  let flameGeo = new THREE.SphereGeometry(0.5, 32, 32);
  flameGeo.translate(0, 0.5, 0);
  let flameMat = getFlameMaterial(true);
  flameMaterials.push(flameMat);
  let flame = new THREE.Mesh(flameGeo, flameMat);
  flame.position.set(-5.61, 8.9, -12.6);
  flame.rotation.y = THREE.MathUtils.degToRad(-45);
  flame.scale.set(0.1,0.1,0.1);
  scene.add(flame);
};

flame(false);
flame(true);

// =======================
//        Animations
// =======================

// -- Animation function --
function animate() {
  // Creates animation loop to render items constantly (as well as their animations)
  requestAnimationFrame( animate );
  // time += last time it was called
  time += clock.getDelta();
  // Updates flameMaterials time (for animation)
  flameMaterials[0].uniforms.time.value = time;
  flameMaterials[1].uniforms.time.value = time;
  // Updates candle lights positions offset by where I placed them
  candleLight2.position.x = (Math.sin(time * Math.PI) * 0.25) -5;
  candleLight2.position.z = (Math.cos(time * Math.PI * 0.75) * 0.25) - 12.6;
  // Updates candle lights intensities
  candleLight2.intensity = 2 + Math.sin(time * Math.PI * 0.5) * Math.cos(time * Math.PI * 1.5) * 0.15;
  // Renders scene with camera
  renderer.render( scene, camera );
  // If mixer is not undefined, then update the mixer at 3 times speed
  if (mixer !== undefined ) mixer.update( clock.getDelta() * 3);
};

// =====================
//      Game logic
// =====================


// -- Raycaster function for detecting what we intersect
const raycastClick  = async function(event) {

  // calculate pointer position in normalized device coordinates
	// (-1 to +1) for both components

  if(event.targetTouches[0]) {
    pointer.x = (event.targetTouches[0].pageX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.targetTouches[0].pageY / window.innerHeight) * 2 + 1;
  } else {
    pointer.x = (event.pageX / window.innerWidth) * 2 - 1;
    pointer.y = -(event.pageY / window.innerHeight) * 2 + 1;
  }


  // Set raycaster from camera
  raycaster.setFromCamera(pointer, camera);
  // Allow raycaster to intersect 3D objects in layer 2
  raycaster.layers.enable(2);

  // Variable which is equal to what the raycaster intersected in our scene
  const intersects = raycaster.intersectObjects(scene.children);

  // If we intersected anything...
  if(intersects.length > 0) { 
    // Check if we intersected the table. If so, execute toggleView function
    if (intersects[0].object.name === "Table_-_Rectangular_Wood_Planks_0001") {
      toggleView();
    // Check if we intersected the bell while not looking at the board. If so, execute the endTurn function
    } else if (intersects[0].object.name === "Bell_Hitbox" && viewToggle === false) {
      endTurn();
    // Check if we intersected the deck while not looking at the board. If so, execute the deckClick function
    } else if (intersects[0].object.name === "deck_hitbox" && viewToggle === false) {
      deckClick();
    // Check if we intersected a card that is also in our hand (not anywhere else)
    } else if(intersects[0].object.name === "Card_Hitbox" && intersects[0].object.inHand === true) {
      // Variable containing the other cards in our hand that weren't clicked on
      const otherCards = cardArr.filter(el => el.handPosition != intersects[0].object.handPosition);
      // Variable containing our selected card
      const selectedCard = cardArr.find(el => el.handPosition === intersects[0].object.handPosition);
      // Set selectedCardHand to our selected card
      selectedCardHand = selectedCard;
      // Get all 3D elements that are children of our selected card
      const selectedCardChildArr = selectedCard.cardObj.parent.children
      // Use GSAP to animate each child
      selectedCardChildArr.forEach(obj => {
        gsap.to(obj.position, {
          z: 8.5,
          duration: 0.25
        })
      });
      // If there are other cards in our hand
      if (otherCards.length) {
        // Animate each of their children to go down (used to reset any cards that animated up when selected)
        otherCards.forEach(obj => {
          const otherCardsChildArr = obj.cardObj.parent.children
          otherCardsChildArr.forEach(obj => {
            gsap.to(obj.position, {
              z: 0,
              duration: 0.25
            })
          });
        });
      }
    // Otherwise..
    } else {
      // If we intersected an object named p1 (hitbox on the board) and we have a card selected, and we're in board view
      if(intersects[0].object.name === "p1" && selectedCardHand && viewToggle === true) {
        // Get the card's stats using our getStats function
        const cardStats = await getStats(selectedCardHand.cardName);
        // If the p1 spot is empty on our board, and our card's cost is 0 or lower
        if(boardState.get('p1') === "" && cardStats.cost <= 0) {
          // Run the playerBoardPosition function
          playerBoardPosition("p1", selectedCardHand.cardObj, selectedCardHand.handPosition);
          // Get the index of the card we want to place from our cardArr which stores the cards in our hand
          const cardIndex = cardArr.indexOf(selectedCardHand);
          // If an index is returned, then splice it from the array since it will no longer be in our hand
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }

          // Get card in p1 slot (as we set it down earlier)
          const card = boardState.get('p1');
          // Set object properties
          card.cardName = selectedCardHand.cardName
          // position in front of our card
          card.frontPos = 'AIF1'
          // Set p1 to our updated object
          boardState.set('p1', card);
          // Set our hand to empty
          selectedCardHand = "";
          // Run updateHand function
          updateHand();
        // If our card has a cost greater than 0, and we intersected the p1 slot, and our sacrifice count doesn't exist yet  
        } else if (cardStats.cost > 0 && boardState.get('p1') !== "" && !selectedCardHand.sacrifice) {
          // Get the card that's currently on our board
          const boardVal = boardState.get('p1');
          const boardStats = await getStats(boardVal.cardName);
          // Initialize cost variable
          let cost;
          // Set cost variable equal to cost of card on board
          if (boardStats.cost === 0) {
            // 0 cost cards should give a sacrifice count of one, not 0
            cost = 1;
          } else {
            cost = boardStats.cost;
          }

          // Up our sacrificeCnt variable by the cost
          sacrificeCnt += cost;

          // Kill the card we just sacrificed
          killCard('p1', boardVal);

          // If the cost has been met, then set sacrifice equal to true
          if (sacrificeCnt >= cardStats.cost){
            selectedCardHand.sacrifice = true;
          }

        // Otherwise, if the p1 slot was intersected, and our card that has a cost has met it's sacrifice threshold
        } else if (boardState.get('p1') === "" && selectedCardHand.sacrifice === true) {
          // Place the card
          playerBoardPosition("p1", selectedCardHand.cardObj, selectedCardHand.handPosition);
          
          // Remove it from our hand array
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          
          // And update the object stored in the boardState map
          const card = boardState.get('p1');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF1'
          boardState.set('p1', card);
          selectedCardHand = "";
          updateHand();
          
          // Reset the sacrifice count
          sacrificeCnt = 0;
      }
      }

      // Section's logic is the same as for p1 but references p2 (Could be refactored into a function with more time)
      if(intersects[0].object.name === "p2" && selectedCardHand && viewToggle === true) {
        const cardStats = await getStats(selectedCardHand.cardName);
        if(boardState.get('p2') === "" && cardStats.cost <= 0) {
          playerBoardPosition("p2", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          const card = boardState.get('p2');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF2'
          boardState.set('p2', card);
          selectedCardHand = "";
          updateHand();
        } else if (cardStats.cost > 0 && boardState.get('p2') !== "" && !selectedCardHand.sacrifice) {
          const boardVal = boardState.get('p2');
          const boardStats = await getStats(boardVal.cardName);
          let cost;
          if (boardStats.cost === 0) {
            cost = 1;
          } else {
            cost = boardStats.cost;
          }
          sacrificeCnt += cost;
          killCard('p2', boardVal);
          if (sacrificeCnt >= cardStats.cost){
            selectedCardHand.sacrifice = true;
          }
        } else if (boardState.get('p2') === "" && selectedCardHand.sacrifice === true) {
          playerBoardPosition("p2", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          const card = boardState.get('p2');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF2'
          boardState.set('p2', card);
          selectedCardHand = "";
          updateHand();
          sacrificeCnt = 0;
        }
      }

      // Section's logic is the same as for p1 but references p3
      if(intersects[0].object.name === "p3" && selectedCardHand && viewToggle === true) {
        const cardStats = await getStats(selectedCardHand.cardName);
        if(boardState.get('p3') === "" && cardStats.cost <= 0) {
          playerBoardPosition("p3", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          const card = boardState.get('p3');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF3'
          boardState.set('p3', card);
          selectedCardHand = "";
          updateHand();
        } else if (cardStats.cost > 0 && boardState.get('p3') !== "" && !selectedCardHand.sacrifice) {
          const boardVal = boardState.get('p3');
          const boardStats = await getStats(boardVal.cardName);
          let cost;
          if (boardStats.cost === 0) {
            cost = 1;
          } else {
            cost = boardStats.cost;
          }
          sacrificeCnt += cost;
          killCard('p3', boardVal);
          if (sacrificeCnt >= cardStats.cost){
            selectedCardHand.sacrifice = true;
          }
        } else if (boardState.get('p3') === "" && selectedCardHand.sacrifice === true) {
          playerBoardPosition("p3", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          const card = boardState.get('p3');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF3'
          boardState.set('p3', card);
          selectedCardHand = "";
          updateHand();
          sacrificeCnt = 0;
        }
      }

      // Section's logic is the same as for p1 but references p4
      if(intersects[0].object.name === "p4" && selectedCardHand && viewToggle === true) {
        const cardStats = await getStats(selectedCardHand.cardName);
        if(boardState.get('p4') === "" && cardStats.cost <= 0) {
          playerBoardPosition("p4", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          const card = boardState.get('p4');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF4'
          boardState.set('p4', card);
          selectedCardHand = "";
          updateHand();
        } else if (cardStats.cost > 0 && boardState.get('p4') !== "" && !selectedCardHand.sacrifice) {
          const boardVal = boardState.get('p4');
          const boardStats = await getStats(boardVal.cardName);
          let cost;
          if (boardStats.cost === 0) {
            cost = 1;
          } else {
            cost = boardStats.cost;
          }
          sacrificeCnt += cost;
          killCard('p4', boardVal);
          if (sacrificeCnt >= cardStats.cost){
              selectedCardHand.sacrifice = true;
          }
        } else if (boardState.get('p4') === "" && selectedCardHand.sacrifice === true) {
          playerBoardPosition("p4", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          const card = boardState.get('p4');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF4'
          boardState.set('p4', card);
          selectedCardHand = "";
          updateHand();
          sacrificeCnt = 0;
      }
      }
    } 
  }
};

// -- Logic for updating our hand on card place --
const updateHand = () => {
  // Check if we even have cards in our hand
  if(cardArr.length) {
    // Check if the first card in our cardArr (which represents our hand) has a handPosition equal to one
    // If not, then we know there is no card in the first hand position
    if(cardArr[0].handPosition != 1) {
      // Update the hand position
      cardArr[0].handPosition = 1;
      // Move the card to the correct spot
      cardArr[0].cardObj.parent.position.setX(-2.25);
      // Update all child 3D elements to have the hand position as property
      const childArr = cardArr[0].cardObj.parent.children
      childArr.forEach(obj => {
        obj.handPosition = 1;
      });

      // If a second card exists, then move that too
      if(cardArr[1]) {
        cardArr[1].handPosition = 2;
        cardArr[1].cardObj.parent.position.setX(-1.8);
        const childArr = cardArr[1].cardObj.parent.children
        childArr.forEach(obj => {
          obj.handPosition = 2;
        });
      }
      
      // If a third card exists, then move that too
      if(cardArr[2]) {
        cardArr[2].handPosition = 3;
        cardArr[2].cardObj.parent.position.setX(-2.68);
        const childArr = cardArr[2].cardObj.parent.children;
        childArr.forEach(obj => {
          obj.handPosition = 3;
        });
      }
    }
    // If there is a second card and the second card has the incorrect hand position
    if(cardArr[1] && cardArr[1].handPosition != 2) {
      // Then we know there is no second card

      // Update the second card's hand position
      cardArr[1].handPosition = 2;
      cardArr[1].cardObj.parent.position.setX(-1.8);
      const childArr = cardArr[1].cardObj.parent.children
      childArr.forEach(obj => {
        obj.handPosition = 2;
      });

      // If there is a third card, update it too
      if(cardArr[2]) {
        cardArr[2].handPosition = 3;
        cardArr[2].cardObj.parent.position.setX(-2.68);
        const childArr = cardArr[2].cardObj.parent.children;
        childArr.forEach(obj => {
          obj.handPosition = 3;
        });
      }

      // 4th card never needs to be moved
    }
    // If there is a third card and it has the incorrect hand position 
    if(cardArr[2] && cardArr[2].handPosition != 3) {
      // Then we move the third card to the correct position
      cardArr[2].handPosition = 3;
      cardArr[2].cardObj.parent.position.setX(-2.68);
      const childArr = cardArr[2].cardObj.parent.children;
      childArr.forEach(obj => {
        obj.handPosition = 3;
      });
    }
  }
};

// -- Logic for allowing a player to place a card onto the board --
const playerBoardPosition = function(position, card, handPos) {
  // Get all card objects (to prevent animation bugginess)
  const cardObjs = card.parent.children;
  
  // If we requested to place to p1
  if (position === "p1") {
    // Create variable to set the boardState p1 key to
    let boardVal = {cardObj: card};
    boardState.set('p1', boardVal);
    // Change the scale and rotation of the card
    cardObjs.forEach(el => {
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);
    
    // Check which hand position our card was in for animating it properly (each hand position needs a different animation)
    if(handPos === 1) {
      gsap.to(el.position, {
        y: -240,
        z: -70,
        x: 107,
        duration: 0.5
      })
    } else if (handPos === 2) {
      gsap.to(el.position, {
        y: -240,
        z: -70,
        x: 157,
        duration: 0.5
      })
    } else if (handPos === 3) {
      gsap.to(el.position, {
        y: -240,
        z: -70,
        x: 60,
        duration: 0.5
      })
    } else if (handPos === 4) {
      gsap.to(el.position, {
        y: -240, 
        z: -70,
        x: 207,
        duration: 0.5
      })
    }
    });
  // Logic is the same as for p1 except we animate differently since gsap animates relative to original position..
  } else if (position === "p2") {
    let boardVal = {};
    boardVal.cardObj = card;
    boardState.set('p2', boardVal)
    cardObjs.forEach(el => {
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);
      if (handPos === 1) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: 18,
          duration: 0.5
        });
      } else if (handPos === 2) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: 68,
          duration: 0.5
        });
      } else if (handPos === 3) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -28,
          duration: 0.5
        });
      } else if (handPos === 4) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: 118,
          duration: 0.5
        })
      }
    });

  } else if (position === "p3") {
    let boardVal = {};
    boardVal.cardObj = card;
    boardState.set('p3', boardVal)
    cardObjs.forEach(el => {
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);
  
      if (handPos === 1) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -71,
          duration: 0.5
        });
      } else if (handPos === 2) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -20,
          duration: 0.5
        });
      } else if (handPos === 3) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -118,
          duration: 0.5
        });
      } else if (handPos === 4) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: 27,
          duration: 0.5
        })
      }
    })
  } else if (position === "p4") {
    let boardVal = {};
    boardVal.cardObj = card;
    boardState.set('p4', boardVal)
    cardObjs.forEach(el => {
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);
  
      if (handPos === 1) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -160,
          duration: 0.5
        });
      } else if (handPos === 2) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -110,
          duration: 0.5
        });
      } else if (handPos === 3) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -208,
          duration: 0.5
        });
      } else if (handPos === 4) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -60,
          duration: 0.5
        })
      }
    })
  } 
};

// -- Logic for toggling the view to board state and back --
const toggleView = function() {
  // If toggle view is false then we animate the camera to board state using gsap
  if (viewToggle === false) {
    // set toggle view to true
    viewToggle = true;
    gsap.to(camera.position, {
      x: -2,
      z: -10.15,
      y: 9.9,
      duration: 0.5,
      onUpdate: () => {
        let originalY = 9.9;
        originalY = originalY - 1;
        camera.lookAt(-2, originalY, -10.15)
      }
    });
    gsap.to(camera.rotation, {
      x: -1.58,
      y: 0,
      z: -0.01,
      duration: 0.5
    });
  // If toggle view is false then we animate back from board state
  } else {
    viewToggle = false;
    gsap.to(camera.position, {
      x: -2,
      z: -5,
      y: 8.5,
      duration: 0.5,
      onUpdate: () => {
        camera.lookAt(-2, 8.5, -10.15);
      }
    });
  }
};

// -- Logic for getting a random item of an array (for getting a random card) --
const randomCard = (arr) => {
  // Returns random index and splices that item from the array so we don't draw it again
  var index = Math.floor(Math.random()*arr.length-1);
      return arr.splice(index, 1);
}

// -- Logic we run when the deck is clicked --
const deckClick = () => {
  // If we haven't drawn already then draw a random card
  if(drawCount < 1) {
    ++drawCount;
    const rCard = randomCard(cards);
    const rCardPath = `./assets/models/Card_models/${rCard}.glb`
    // Call the drawCard function with our card model path
    drawCard(rCardPath);
  // Otherwise, do nothing
  } else {
    return;
  }
};

// -- Logic for loading the drawn card and adding it to our hand --
const drawCard = function(cardPath) {
  // Create a variable representing the top card of our deck 3D model
  let drawCard = deck.scene.children[deck.scene.children.length - 1];

  // If our hand's array is less than 4 (4 is max) and the deck isn't empty then run the animation
  if (cardArr.length < 4 && deck.scene.children.length) {
    gsap.to(drawCard.position, {
      x: 80,
      y: 8.5,
      z: -100,
      duration: 0.25,
      onComplete: () => {
        deck.scene.children.pop();
      }
    })
  }

  // If there are no cards in the deck then do nothing
  if (deck.scene.children.length == 0) {
    return;
  }

  // If our hand isn't full and there are cards to draw then execute this code
  if (cardArr.length < 4 && deck.scene.children.length != 0) {
    // Load the random card specified
    loader.load(`${cardPath}`, (gltf) => {
      // Object for formatting card data
      const cardObjFormat = {}
      const cardObj = gltf.scene;
        // Traverse all children of the card object to set them all to layer 2
        // We do this to avoid raycaster bugginess, allowing it to intersect the cards before anything else
        cardObj.traverse(function(object) {
          object.layers.set(2);
        })

        // Object properties
        cardObj.castShadow = true;
        cardObj.scale.set(0.009,0.009,0.009);
        cardObj.position.setY(6);
        cardObj.position.setZ(-6.6);
        cardObj.rotation.set(-1.57,0,-3.15);
        // Since we have a card_hitbox in the model for the raycaster..
        // we need to get the child of our card object to represent the object, not the hitbox
        cardObjFormat.cardObj = gltf.scene.children[1];
        // Get the card's name from the model
        cardObjFormat.cardName = gltf.scene.children[1].name;

        // Set both children of the object to have the inHand property set to true
        cardObj.children[1].inHand = true;
        cardObj.children[0].inHand = true;
      
      // If our hand has no cards then animate it to a first position
      if(cardArr.length === 0) {
        cardObjFormat.handPosition = 1;
        cardObj.children.forEach(el => {
          el.handPosition = 1;
        });
        cardObj.position.setX(-2.25);
        gsap.to(cardObj.position, {
          y: 7.65,
          duration: 0.5
        });
      // Otherwise, animate it to second position.. and so on
      } else if(cardArr.length === 1) {
        cardObjFormat.handPosition = 2;
        cardObj.children.forEach(el => {
          el.handPosition = 2;
        })
        cardObj.position.setX(-1.8);
        gsap.to(cardObj.position, {
          y: 7.65,
          duration: 0.5
        });
      } else if(cardArr.length === 2) {
        cardObjFormat.handPosition = 3;
        cardObj.children.forEach(el => {
          el.handPosition = 3;
        })
        cardObj.position.setX(-2.68);
        gsap.to(cardObj.position, {
          y: 7.65,
          duration: 0.5
        });
      } else if(cardArr.length === 3) {
        cardObjFormat.handPosition = 4;
        cardObj.children.forEach(el => {
          el.handPosition = 4;
        })
        cardObj.position.setX(-1.35);
        gsap.to(cardObj.position, {
          y: 7.65,
          duration: 0.5
        });
      } else {
        // We reset the draw count since we up it whenever we click on the deck. this detects when our hand is full, so we don't
        // want the drawCount to go up if we never drew a card
        drawCount = 0;
      }

      // Add the object to the scene and push our formatted object to the cardArr
      cardArr.push(cardObjFormat);
      scene.add(cardObj);
    })
  } else {
    // Same logic as above for resetting draw count when hand is full
    drawCount = 0;
  }
};

// -- Logic for giving the user an initial hand --
const initialHand = () => {
  // Loops through 2 of our noCostCards since you can be softlocked from the game if you can't place a card down due to it having a cost greater than 0
  for(let i=0; i < 2; i++) {
    const rCard = randomCard(noCostCards);
    const rCardPath = `./assets/models/Card_models/${rCard}.glb`
    drawCard(rCardPath);
    const index = cards.indexOf(rCard[0]);
    cards.splice(index, 1);
  }
  // Gets two random cards of any cost
  for (let i=0; i < 2; i++) {
    const rCard = randomCard(cards);
    const rCardPath = `./assets/models/Card_models/${rCard}.glb`
    drawCard(rCardPath);
    // ---- For debugging (Lol) ----
    // const testCardPath = './assets/models/Card_models/bug.glb'
    // drawCard(testCardPath);
  }
};

// -- Get a random integer from an interval --
// Credit: https://stackoverflow.com/questions/4959975/generate-random-number-between-two-numbers-in-javascript
const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min)
};

// -- Logic for the opponent's initial hand --
const opponentInitialDraw = () => {
  // We don't always want the AI to have 4 cards initially, so we get a random integer between 1 and 4
  const rdmInt = randomIntFromInterval(1,4);
  // We want our AI to place the cards in random spots, so this represents the available positions
  const numPool = [1,2,3,4]
  // For each number in our interval
  for(let i=1; i <= rdmInt; i++) {
    // Get the index of the position we want it to go to
    var index = Math.floor(Math.random()*numPool.length-1);
    // Remove that position from the list of available positions and set our variable equal to the element returned
    const cardPos = numPool.splice(index, 1);
    // Get a random card from the opponent's array of cards
    const rCard = randomCard(oppCards);
    const rCardPath = `./assets/models/Card_models/${rCard}.glb`;
    // Run the opponentPlaceCards function using the card and position we want it to go
    opponentPlaceCards(rCardPath, cardPos[0]);
  }
};

// -- Logic dictating when and how many cards the opponent draws --
const opponentDraw = () => {
  // Get the board states of the draw spots
  const bs1 = boardState.get('AIB1');
  const bs2 = boardState.get('AIB2');
  const bs3 = boardState.get('AIB3');
  const bs4 = boardState.get('AIB4');
  // Array representing which spots are open, since we don't want the AI to try to place a card
  // In a spot that's occupied
  const numPool = [];

  // If the first spot is empty then add it to the pool, and so on...
  if(!bs1) { numPool.push(1); } 
  if(!bs2) { numPool.push(2); }
  if(!bs3) { numPool.push(3); }
  if(!bs4) { numPool.push(4); }
  
  // If all spots aren't occupied then run the draw logic
  if(numPool.length != 0) {
    numPool.forEach(num => {
      // For each available spot there is a 50% chance that we generate a card to occupy that spot
      const coinFlip = Math.floor(Math.random() * 2) == 0;
      // If coinFlip didn't round down to 0 then we run our draw logic
      if(coinFlip) {
        // Get a random card and place it
        const rCard = randomCard(oppCards);
        const rCardPath = `./assets/models/Card_models/${rCard}.glb`;
        opponentPlaceCards(rCardPath, num);
      }
    })
  }
};

// -- Logic dictating how the AI loads a card onto the table --
const opponentPlaceCards = (cardPath, pos) => {
  // Using the card path given and the position we want it to go to, then we load the card
    loader.load(`${cardPath}`, (gltf) => {
      // Object for formatting data
      const cardObjFormat = {}
      const cardObj = gltf.scene;
      // Sets the card's layer to 2
        cardObj.traverse(function(object) {
          object.layers.set(2);
        })
        
        // Settings for the card
        cardObj.layers.set(0);
        cardObj.castShadow = true;
        cardObj.scale.set(0.016,0.016,0.016);
        cardObj.rotation.set(-3.15,0,-3.15);

        // Data for use later
        cardObjFormat.cardObj = gltf.scene.children[1];
        cardObjFormat.cardName = gltf.scene.children[1].name;

        // Checks which position we want the card to go to
        if(pos === 1) {
          // Sets the card to its appropriate position, sets the frontPos to the position
          // in front of the card, and sets the backPos to the spot its in (if we need it for features down the line)
          cardObj.position.setZ(-11.53);
          cardObj.position.setX(-3.18);
          cardObj.position.setY(7.015);
          cardObjFormat.frontPos = 'AIF1'
          cardObjFormat.backPos = 'AIB1'
          // Updates board state
          boardState.set('AIB1', cardObjFormat);
        // And so on..
        } else if(pos === 2) {
          cardObj.position.setZ(-11.53);
          cardObj.position.setX(-2.38);
          cardObj.position.setY(7.015);
          cardObjFormat.frontPos = 'AIF2'
          cardObjFormat.backPos = 'AIB2'
          boardState.set('AIB2', cardObjFormat);
        } else if(pos === 3) {
          cardObj.position.setZ(-11.53);
          cardObj.position.setX(-1.58);
          cardObj.position.setY(7.015);
          cardObjFormat.frontPos = 'AIF3'
          cardObjFormat.backPos = 'AIB3'
          boardState.set('AIB3', cardObjFormat);
        } else if(pos === 4) {
          cardObj.position.setZ(-11.51);
          cardObj.position.setX(-0.77);
          cardObj.position.setY(7.015);
          cardObjFormat.frontPos = 'AIF4'
          cardObjFormat.backPos = 'AIB4'
          boardState.set('AIB4', cardObjFormat);
        } else {
          return;
        }
      
      // Adds card to the scene
      scene.add(cardObj);
    });
};

// -- Logic for moving the AI's backrow cards up --
const backrowPush = async () => {
  // Checks if there are any cards to move up
  const bs1 = boardState.get('AIB1');
  const bs2 = boardState.get('AIB2');
  const bs3 = boardState.get('AIB3');
  const bs4 = boardState.get('AIB4');
  const statePool = [];
  statePool.push(bs1,bs2,bs3,bs4);

  statePool.forEach(async el => {
    // If there is nothing occupying the spot then return
    if(el === "") {
      return;
    // Otherwise..
    } else {
      // Check if there is a card blocking our path
      const frontPosState = boardState.get(el.frontPos);
      // If it's empty then we move our card up
      if(frontPosState === "") {
        boardState.set(el.frontPos, el);

        // Checks which spot we're in by checking the frontPos in our object
        if(el.frontPos === 'AIF1') {
          // Updates data
          const updatedEl = el;
          updatedEl.frontPos = 'p1';
          // updates board state
          boardState.set('AIF1', updatedEl);
        // And so on..
        }
        if(el.frontPos === 'AIF2') {
          const updatedEl = el;
          updatedEl.frontPos = 'p2';
          boardState.set('AIF2', updatedEl);
        }
        if(el.frontPos === 'AIF3') {
          const updatedEl = el;
          updatedEl.frontPos = 'p3';
          boardState.set('AIF3', updatedEl);
        }
        if(el.frontPos === 'AIF4') {
          const updatedEl = el;
          updatedEl.frontPos = 'p4';
          boardState.set('AIF4', updatedEl);
        }

        // Animation for moving the card up the board
        const childArr = el.cardObj.parent.children
        childArr.forEach(el => {
          gsap.to(el.position, {
            z: -82,
            duration: 1,
          });
        });

        // Empty the position behind our element in our boardState map
        boardState.set(el.backPos, "");
      }
    }
  });
};

// -- Logic for ending the turn -- 
const endTurn = async function() {
  // Resets draw and sacrifice count
  sacrificeCnt = 0;
  drawCount = 0;
  // Checks if either deck is empty and reshuffles accordingly
  if(cards.length === 0) {
    reshuffleDeck();
  }
  if(oppCards.length === 0) {
    oppCards = [
      'BootStrapped','BrokenCode','Bug','Cookie','DeathNode','destroyEnemy(you)','Documentation','Firewall','Gitbasher','GitSome','GoogleFu','GrimRepo','Hello World','if(losing)','Iterator','JACK','JSONFoorhees','Loop','NullPointer','OffCenterDiv','RobloxDevOps','RubberDuck','SQLSyntaxErr','Syntax Err'
    ];
  }
  // When we end the turn we want to toggle to board view
  toggleView();
  // When we end the turn we want to push backrow cards 
  backrowPush();
  // Delay for running attack animations
  setTimeout(async () => {
    // Ups turn count
    turn++;
    // We will never draw on the first turn
    if(turn > 0) {
      // If the turn is even then run a coinflip
      if(turn % 2 === 0) {
        const coinFlip = Math.floor(Math.random() * 2) == 0;
        if(coinFlip) {
          // If the coinflip is true then we run our draw logic
          opponentDraw();
        }
      }
      // Get all keys in the board
      const spots = boardState.keys();
      for await (const spot of spots) {
        // Get data from our key
        const val = boardState.get(spot);
        // If there is a card in that position
        if(val) {
          // Check it's remaining health, if it has none then don't let it attack
          if(val.remainingHealth === 0) {
            return;
          }

          // Otherwise, run our deal damage function
          await dealDamage(spot, val)
        }
      }
    }
  // Run the check game function
  checkGame();
  }, 1000);
};

// -- Logic for animating attacks --
const animateAttack = (spot) => {

  // Get value of card occupying spot from board state map
  const spotVal = boardState.get(spot);

  // Get value of card opposing the card we're animating
  const frontPos = spotVal.frontPos;
  const frontPosVal = boardState.get(frontPos);

  // If one of the player spots..
  if(spot === 'p1' || spot === 'p2' || spot === 'p3' || spot === 'p4') {
    // Create an array which stores all objects we want to animate
    const animateArr = [];
    // Get parent of the object to avoid animation bugs
    const parent = spotVal.cardObj.parent
    // If there is a text mesh over our card and the card in front is empty, then add the mesh to be animated
    if(spotVal.textX && frontPosVal === "") {
      const textX = spotVal.textX;
      const textMesh = spotVal.text;
      animateArr.push(textX);
      animateArr.push(textMesh);
    // If there is a text mesh and the card in front has no health remaining then add the mesh to be animated
    } else if (spotVal.textX && frontPosVal.remainingHealth === 0) {
      const textX = spotVal.textX;
      const textMesh = spotVal.text;
      animateArr.push(textX);
      animateArr.push(textMesh);
    }

    // Always push the parent object to our animation array
    animateArr.push(parent);

    // Run the attack animations
    animateArr.forEach(el => {
      gsap.to(el.position, {
        z: el.position.z - 0.25,
        duration: 0.15,
        onComplete: () => {
          gsap.to(el.position, {
            z: el.position.z + 0.25,
            duration: 0.15
          })
        }
      })
    })

  // Otherwise, if one of the AI spots, we run the same logic but the animation is reversed
  // (some of the logic could be refactored into a function)
  } else if (spot === 'AIF1' || spot === 'AIF2' || spot === 'AIF3' || spot === 'AIF4') {
    const animateArr = [];
    const parent = spotVal.cardObj.parent
    if(spotVal.textX && frontPosVal === "") {
      const textX = spotVal.textX;
      const textMesh = spotVal.text;
      animateArr.push(textX);
      animateArr.push(textMesh);
    } else if (spotVal.textX && frontPosVal.remainingHealth === 0) {
      const textX = spotVal.textX;
      const textMesh = spotVal.text;
      animateArr.push(textX);
      animateArr.push(textMesh);
    }

    animateArr.push(parent);

    animateArr.forEach(el => {
      gsap.to(el.position, {
        z: el.position.z + 0.25,
        duration: 0.15,
        onComplete: () => {
          gsap.to(el.position, {
            z: el.position.z - 0.25,
            duration: 0.15
          })
        }
      })
    })
  }
};

// -- Logic for calculating damage dealth --
const dealDamage = async (spot, val) => {
  // If the spot is any of the AI backrow spots, then return since they cannot attack
  if (spot === "AIB1" || spot === "AIB2" || spot === "AIB3" || spot === "AIB4") {
    return;
  // Otherwise..
  } else {
    // Initialize opponent variable
    let opponent;
    // If one of the player spots then the opponent is the AI
    if (spot === "p1" || spot === "p2" || spot === "p3" || spot === "p4") {
      opponent = 'AI';
    // If one of the AI spots then the opponent is the player
    } else {
      opponent = 'player';
    }

    // If the card has greater than 0 health or remainingHealth hasn't been defined yet
    if(val.remainingHealth > 0 || val.remainingHealth === undefined) {
      // Get the stats of the card and the value of the card in front
      const valStats = await getStats(val.cardName);
      const frontVal = boardState.get(val.frontPos);
      // If there is a card in front and the card can attack (attack greater than 0)
      if(frontVal && valStats.attack > 0) {
        // Get the stats of the card in front
        const frontStats = await getStats(frontVal.cardName);
        // If the card in front has had its health updated, run the logic below
        if(frontVal.remainingHealth) {
          // Variable representing the new remaining health
          let frontValHealth = frontVal.remainingHealth - valStats.attack
          // ** For debugging **
          // console.log(frontVal.cardName + " has " + frontValHealth + " health remaining!");

          // If the health has gone into a negative value execute this code
          if(frontValHealth < 0) {
            // Calculates cleave damage by setting our negative value to a positive one
            const cleaveDmg = frontValHealth * -1
            // ** For debugging **
            // console.log('deal ' + cleaveDmg + ' to opponent');

            // Checks which opponent to deal cleave damage to
            if(opponent === 'AI') {
              // Updates health
              AIHealth -= cleaveDmg;
              // ** For debugging **
              // console.log('AI has ' + AIHealth + ' health left.');
            } else {
              playerHealth -= cleaveDmg;
              // ** For debugging **
              // console.log('player has ' + playerHealth + ' health left.');
            }

            // Sets the health to 0 since it went negative
            frontValHealth = 0;
            // Updates the card in front of our's health
            frontVal.remainingHealth = frontValHealth;
            // Updates the board state
            boardState.set(val.frontPos, frontVal);
            // Runs the animate attack function
            animateAttack(spot);
            // Runs the kill card function for the card in front since it died
            killCard(val.frontPos, frontVal);
            return;
          // Checks if the remaining health is exactly 0 for the card in front
          } else if (frontValHealth === 0) {
            // If so, then no cleave damage was dealt
            // console.log('exact dmg, no cleave done');
            // Set the health to 0
            frontValHealth = 0;
            // Update card and board
            frontVal.remainingHealth = frontValHealth;
            boardState.set(val.frontPos, frontVal);
            animateAttack(spot);
            killCard(val.frontPos, frontVal);
            return;
          }
          
          // Sets the card's remaining health equal to the health we calculated
          frontVal.remainingHealth = frontValHealth;
          // Updates the board state
          boardState.set(val.frontPos, frontVal);
          // Runs the update Card function and then the animate attack function
          updateCard(spot);
          animateAttack(spot);
        // If the card hasn't had its health updated then run similar logic with slight differences (could really be refactored into a function)
        } else if (!frontVal.remainingHealth) {
          // Instead of calculating health from remaining health, calculate it from attack
          let frontValHealth = frontStats.defense - valStats.attack
          // Same as above..
          if(frontValHealth < 0) {
            const cleaveDmg = frontValHealth * -1
            if(opponent === 'AI') {
              AIHealth -= cleaveDmg;
              //console.log('AI has ' + AIHealth + ' health left.');
            } else {
              playerHealth -= cleaveDmg;
              //console.log('player has ' + playerHealth + ' health left.');
            }
            frontValHealth = 0;
            frontVal.remainingHealth = frontValHealth;
            boardState.set(val.frontPos, frontVal);
            killCard(val.frontPos, frontVal);
            animateAttack(spot);
            return;
          } else if (frontValHealth === 0) {
            //console.log('exact dmg, no cleave done');
            frontValHealth = 0;
            frontVal.remainingHealth = frontValHealth;
            boardState.set(val.frontPos, frontVal);
            killCard(val.frontPos, frontVal);
            animateAttack(spot);
            return;
          }
          frontVal.remainingHealth = frontValHealth;
          boardState.set(val.frontPos, frontVal);
          updateCard(spot);
          animateAttack(spot);
        } 
      } else if (valStats.attack > 0) {
        // Checks if we have an attack stat and if there is no card in front
        //console.log('direct damage of ' + valStats.attack + ' done to opponent');
        // Deals direct damage to the opponent
        if(opponent === 'AI') {
          AIHealth -= valStats.attack;
          //console.log('AI has ' + AIHealth + ' health left.');
        } else {
          playerHealth -= valStats.attack;
          //console.log('player has ' + playerHealth + ' health left.');
        }
        animateAttack(spot);
      }
    } else {
      // If the card has no health remaining then we run the kill card function
      killCard(spot, val);
    }
  }
};

// -- Logic for killing cards --
const killCard = (key, val) => {

  // Death animation (simply moves them beneath the board)
  gsap.to(val.cardObj.parent.position, {
    y: val.cardObj.parent.position.y - 1,
    duration:2
  })
  // If the card has a text mesh over it then animate that too
  if(val.textX) {
    gsap.to(val.textX.position, {
      y: val.textX.position.y -1,
      duration: 2
    })
    gsap.to(val.text.position, {
      y: val.text.position.y -1,
      duration: 2
    })
  }

  // After 2 seconds remove the cards from the scene
  setTimeout(() => {
    scene.remove(val.cardObj.parent);
    scene.remove(val.textX);
    scene.remove(val.text);
  }, 2000)

  // Update the board state using the key of the card we killed
  boardState.set(key, "");
};

// -- Logic for getting the stats of our card from our database --
const getStats = async (name) => {
  // Sends a fetch request and returns response
  const response = await fetch(`/api/cards/name/${name}`)
  const json = await response.json();
  return json;
}

// -- Logic for reshuffling the player deck --
const reshuffleDeck = () => {
  // Removes the deck model
  scene.remove(deck);
  // Reloads it (with all cards returned)
  loadDeck();
  // Resets the cards array
  cards = [
    'BootStrapped','BrokenCode','Bug','Cookie','DeathNode','destroyEnemy(you)','Documentation','Firewall','Gitbasher','GitSome','GoogleFu','GrimRepo','Hello World','if(losing)','Iterator','JACK','JSONFoorhees','Loop','NullPointer','OffCenterDiv','RobloxDevOps','RubberDuck','SQLSyntaxErr','Syntax Err'
  ];
};

// -- Logic for checking the game state --
const checkGame = () => {
  // Runs the adjust health function
  adjustHealth();

  // So the player can briefly see they died, have a delay on these function calls
  setTimeout(() => {
    if(playerHealth <= 0) {
      // If the player died first then run the game over function as a loss
      gameOver('loss');
    } else if (AIHealth <= 0) {
      // If the AI died first then run the game over function as a win
      gameOver('win');
    }
  }, 500)
};

// -- Logic for ending the game --
const gameOver = async (gameState) => {
  // Gets current player's high score (uses session ID)
  const response = await fetch('/api/players/highscore');
  const json = await response.json();
  const highscore = await json.highscore;
  // Sets the score equal to the turns they survived
  let score = turn;
  // If the player won then multiply their score based on how quickly the game ended
  // calculation could definitely be improved but the highscore is just for demo purposes.. so it stays
  if(gameState === 'win') {
    // If you won in one turn just set the score to 100000
    if (score === 1) {
      score *= 100000
    }
    // If you won in less than 5 then multiply by this factor
    if (score < 5) {
      score *= 5000
    }

    // etc..
    if(score < 10) {
      score *= 1000;
    } else if (score < 20) {
      score *= 100;
    } else {
      score *= 10;
    }
  } 

  // If there is a null score in the database or the current highscore is less then the new score
  if (!highscore || highscore < score) {
    // Update our databse
    const response = await fetch('/api/players', {
      method: 'PUT',
      body: JSON.stringify({
        score
      }),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // If the update request went through okay, then load the leaderboard page
    if (response.ok) {
      // If we lost then set the paramter to loss
      if(gameState === 'loss') {
        document.location.replace('/leaderboard?loss');
      } else {
      // Otherwise set the pramater to win
       document.location.replace('/leaderboard?win');
      }
    } else {
      // If error then alert
      alert(response.statusText);
    }
  } else {
    // Otherwise don't update the highscore but still send the player to the highscore page
    if(gameState === 'loss') {
      document.location.replace('/leaderboard?loss');
    } else {
      document.location.replace('/leaderboard?win');
    }
  }
};

// -- Logic for generating updated health 3D models on top of cards -- 
// !!If using another engine or model type this wouldn't be necessary!!
const updateCard = async (spot) => {
  
  // Gets spot sent as argument and gets the value of the spot in front of it as well
  const spotVal = boardState.get(spot);
  const frontPos = spotVal.frontPos;
  const frontVal = boardState.get(frontPos);
  // Initialize variables
  let health;
  let fontSize = 0.2;

  // If text already exists, remove it since we can't update it
  if(frontVal.textX || frontVal.text) {
    scene.remove(frontVal.textX);
    scene.remove(frontVal.text);
  } 

  // -- Logic for animating the text when it's created so it doesn't desync with the attack animation --
  const textAnimate = (spot, el) => {
    // If one of the player spots then don't run the animation due to timing issues
    if(spot === 'p1' || spot === 'p2' || spot === 'p3' || spot === 'p4') {
      return;
    // Otherwise, animate
    } else if (spot === 'AIF1' || spot === 'AIF2' || spot === 'AIF3' || spot === 'AIF4') {
      gsap.to(el.position, {
        z: el.position.z - 0.25,
        duration: 0.15,
        onComplete: () => {
          gsap.to(el.position, {
            z: el.position.z + 0.25,
            duration: 0.15
          })
        }
      })
    }
  }

  // Initialize variables representing text positions based on where on the board they need to be rendered
  let x;
  let z;

  if (spot === 'p4') {
    x = -0.65;
    z = -9.7;
  }

  if(spot === 'p3') {
    x = -1.45;
    z = -9.7;
  }

  if(spot === 'p2') {
    x = -2.25;
    z = -9.7;
  }

  if(spot === 'p1') {
    x = -3.05;
    z = -9.7;
  }

  if(spot === 'AIF4') {
    x = -0.65;
    z = -8.23;
  }

  if(spot === 'AIF3') {
    x = -1.45;
    z = -8.23;
  }

  if(spot === 'AIF2') {
    x = -2.25;
    z = -8.23;
  }

  if(spot === 'AIF1') {
    x = -3.05;
    z = -8.23;
  }

  // Reduces font size if the remaining health is above 10
  if(frontVal.remainingHealth) {
    health = frontVal.remainingHealth;
    if (health >= 10) {
      fontSize = 0.1;
    }
  }

// Loads in text
fontLoader.load(
  './assets/fonts/droid_sans_mono_regular.typeface.json',
  (droidFont) => {
    // Creates text (letter X)
    const textGeometry = new TextGeometry('X', {
      height: 0,
      size: 0.2,
      font: droidFont
    })
    // Sets text material to black
    const textMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
    // Creates mesh around the geometry
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    // Adds the mesh
    scene.add(textMesh);
    // Positions text
    textMesh.position.setZ(z);
    textMesh.position.setX(x);
    textMesh.position.setY(7.059);
    textMesh.rotation.set(-1.575,0,0);
    frontVal.textX = textMesh;
    // Animates text 
    textAnimate(spot, textMesh)
  }
);

// Same as above..
fontLoader.load(
  './assets/fonts/droid_sans_mono_regular.typeface.json',
  (droidFont) => {
    const textGeometry = new TextGeometry(`${health}`, {
      height: 0,
      size: fontSize,
      font: droidFont
    })
    const textMaterial = new THREE.MeshBasicMaterial({color: 0xFF0000});
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    scene.add(textMesh);
    textMesh.position.setZ(z);
    textMesh.position.setX(x);
    textMesh.position.setY(7.065);
    textMesh.rotation.set(-1.575,0,0);
    frontVal.text = textMesh
    textAnimate(spot, textMesh);
  }
)
};

// -- Logic for adjusting health overlay --
// function credit: Kenan McKenzie (as well as health bars)
function adjustHealth() {
  //variables selecting icons)
  
  // Removes hearts every time the player or AI loses 10 health
  // When either reaches 0 or below, replace health bar with skull cross bone emoji
  if (playerHealth <= 40) {
      heart5.classList.add("hidden")
  }
  if (playerHealth <= 30) {
      heart4.classList.add("hidden")
  }
  if (playerHealth <= 20) {
      heart3.classList.add("hidden")
  }
  if (playerHealth <= 10) {
      heart2.classList.add("hidden")
  }
  if (playerHealth <= 0) {
      heart1.classList.add("hidden")
      heart3.classList.remove("hidden")
      heart3.classList.add("fa-solid", "fa-skull-crossbones")
  }
  
  if (AIHealth <= 40) {
      oppheart5.classList.add("hidden")
  }
  if (AIHealth <= 30) {
      oppheart4.classList.add("hidden")
  }
  if (AIHealth <= 20) {
      oppheart3.classList.add("hidden")
  }
  if (AIHealth <= 10) {
      oppheart2.classList.add("hidden")
  }
  if (AIHealth <= 0) {
      oppheart1.classList.add("hidden")
      oppheart3.classList.remove("hidden")
      oppheart3.classList.add('fa-solid', 'fa-skull-crossbones')
  }
};

// -- Event listener that listens to when the page is resized so we can make the 3D canvas responsive --
// Otherwise it'd just stay the dimensions it was first loaded in
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false)

// Adds our raycaster listener to the whole window
window.addEventListener('click', raycastClick);
window.addEventListener('touchstart', raycastClick);

// Calls functions
opponentInitialDraw();
animate();