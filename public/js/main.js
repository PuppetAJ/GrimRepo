import * as THREE from 'three';
import {OrbitControls} from 'OrbitControls';
import {GLTFLoader} from 'GLTFLoader';
import {gsap} from 'GSAP';
import {TextGeometry} from 'TextGeometry';
import {FontLoader} from 'FontLoader';

// up brightness?
// Display remaining health to screen
// Create leaderboard / highscore item on a player
// block screen so user can't interact with game when on login page, or make it render on another page
// Check if game is over, if so detect if player lost or won
// if game is over, take to leaderboard page
// display either game over or you won! depending on if they won or not
// use their username (from being logged in) to insert into leaderboard
// media queries to rotate screen on mobile?
// organize code
// create utils folder with withAuth() function
// loading screen? make disappear when 100% loaded

let boardState = new Map();

boardState.set('p1', "");
boardState.set('p2', "");
boardState.set('p3', "");
boardState.set('p4', "");

boardState.set('AIB1', "");
boardState.set('AIB2', "");
boardState.set('AIB3', "");
boardState.set('AIB4', "");

boardState.set('AIF1', "");
boardState.set('AIF2', "");
boardState.set('AIF3', "");
boardState.set('AIF4', "");


let AIHealth = 30;
let playerHealth = 50;

var clock = new THREE.Clock();
var time = 0;
let obj;
//let currentCard;
let mixer;
let deck;
let cardArr = [];
let selectedCardHand;
let initialPass = false;
let turn = 0;
let drawCount = 0;

const fontLoader = new FontLoader();

const loadingManager = new THREE.LoadingManager();

const scene = new THREE.Scene();

const gridHelper = new THREE.GridHelper( 100, 100 );
scene.add(gridHelper);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.layers.enable(2);

const renderer = new THREE.WebGL1Renderer({
  canvas: document.querySelector('#bg'),
  antialias: true
});
 
//renderer.outputEncoding = THREE.sRGBEncoding;

renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight);
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0.0);

camera.position.setX(-2);
camera.position.setY(8.5);
camera.position.setZ(-5);

//camera.lookAt(camera.position);

renderer.render( scene, camera );

loadingManager.onLoad = async function() {
  if(initialPass === false) {
    //console.log("done loading!");
    initialHand();
    initialPass = true;
  }
}

const loader = new GLTFLoader(loadingManager);
//const controls = new OrbitControls(camera, renderer.domElement);

loader.load(
  './assets/models/house.glb', 
  function ( gltf ) {
    //console.log(gltf);
    obj = gltf.scene;
    obj.castShadow = true;
    obj.scale.set(20,20,20);
    scene.add(obj);

}, undefined, function (error) {
  console.error(error);
}
)

loader.load(
  './assets/models/robot.glb', 
  function ( gltf ) {
    //console.log(gltf);
    obj = gltf.scene;
    obj.castShadow = true;
    obj.scale.set(100,100,100);
    obj.position.setZ(-10);
    obj.position.setX(-2);
    obj.position.setY(2);
    obj.rotation.set(0,3.1,0);
    mixer = new THREE.AnimationMixer(gltf.scene);
    const clips = gltf.animations;
    const clip = THREE.AnimationClip.findByName( clips, 'ArmatureAction' );
    const action = mixer.clipAction(clip);
    action.play();
    clips.forEach( function (clip) {
     mixer.clipAction(clip).play();

    })
    scene.add(obj);

}, undefined, function (error) {
  console.error(error);
}
)

loader.load(
  './assets/models/game_board.glb', 
  function ( gltf ) {
    //console.log(gltf);
    obj = gltf.scene;
    obj.castShadow = true;
    obj.scale.set(0.02,0.02,0.02);
    obj.position.setZ(-10);
    obj.position.setX(-1.6);
    obj.position.setY(6.9785);
    obj.rotation.set(3.15,3.15,0);
    scene.add(obj);

}, undefined, function (error) {
  console.error(error);
}
)

// loader.load(
//   './assets/models/card_merge.glb', 
//   function ( gltf ) {
    
//     //console.log(gltf);
//     obj = gltf.scene;
//     //currentCard = gltf;
//     obj.castShadow = true;
//     obj.scale.set(0.017,0.017,0.017);
//     obj.position.setZ(-8.8);
//     obj.position.setX(-0.79);
//     obj.position.setY(6.993);
//     obj.rotation.set(-3.15,0,-3.15);
//     scene.add(obj);



// }, undefined, function (error) {
//   console.error(error);
// }
// )
const loadDeck = () => {
  loader.load(
    './assets/models/deck.glb', 
    function ( gltf ) {
      
      //console.log(gltf);
      obj = gltf.scene;
      deck = gltf;
      obj.castShadow = true;
      obj.scale.set(0.017,0.017,0.017);
      obj.position.setZ(-8.8);
      obj.position.setX(0.5);
      obj.position.setY(6.993);
      obj.rotation.set(-3.15,0,-3.15);
      scene.add(obj);
  
  
  
  }, undefined, function (error) {
    console.error(error);
  }
  )
}
loadDeck();


loader.load(
  './assets/models/bell.glb', 
  function ( gltf ) {
    
    //console.log(gltf);
    obj = gltf.scene;
    obj.castShadow = true;
    obj.scale.set(0.01,0.01,0.01);
    obj.position.setZ(-8.8);
    obj.position.setX(-4.4);
    obj.position.setY(6.993);
    obj.rotation.set(-3.15,0,-3.15);
    scene.add(obj);



}, undefined, function (error) {
  console.error(error);
}
)

const ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
scene.add(ambientLight);

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
}

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
}

flame(false);
flame(true);

function animate() {
  requestAnimationFrame( animate );
  time += clock.getDelta();
  flameMaterials[0].uniforms.time.value = time;
  flameMaterials[1].uniforms.time.value = time;
  candleLight2.position.x = (Math.sin(time * Math.PI) * 0.25) -5;
  candleLight2.position.z = (Math.cos(time * Math.PI * 0.75) * 0.25) - 12.6;
  candleLight2.intensity = 2 + Math.sin(time * Math.PI * 0.5) * Math.cos(time * Math.PI * 1.5) * 0.15;
  renderer.render( scene, camera );
  if (mixer !== undefined ) mixer.update( clock.getDelta() * 3);
}

// function removeAllChildNodes(parent) {
//   while (parent.firstChild) {
//     parent.removeChild(parent.firstChild);
//   }
// }

const pointer = new THREE.Vector2();
const raycaster = new THREE.Raycaster();
let viewToggle = false;

let sacrificeCnt = 0;

const raycastClick  = async function(event) {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  raycaster.layers.enable(2);
  const intersects = raycaster.intersectObjects(scene.children);
  if(intersects.length > 0) {
    //console.log(intersects[0].object); 
    if (intersects[0].object.name === "Table_-_Rectangular_Wood_Planks_0001") {
      toggleView();
    } else if (intersects[0].object.name === "Bell_Hitbox" && viewToggle === false) {
      endTurn();
    } else if (intersects[0].object.name === "deck_hitbox" && viewToggle === false) {
      deckClick();
    } else if(intersects[0].object.name === "Card_Hitbox" && intersects[0].object.inHand === true) {
      // console.log(intersects[0].object);
      const otherCards = cardArr.filter(el => el.handPosition != intersects[0].object.handPosition);
      const selectedCard = cardArr.find(el => el.handPosition === intersects[0].object.handPosition);
      selectedCardHand = selectedCard;
      //console.log(selectedCard);
      //console.log(intersects[0].object.handPosition);
      //console.log(otherCards);
      const selectedCardChildArr = selectedCard.cardObj.parent.children
      selectedCardChildArr.forEach(obj => {
        gsap.to(obj.position, {
          z: 8.5,
          duration: 0.25
        })
      })
      if (otherCards.length) {
        //console.log("other cards!");
        otherCards.forEach(obj => {
          const otherCardsChildArr = obj.cardObj.parent.children
          otherCardsChildArr.forEach(obj => {
            gsap.to(obj.position, {
              z: 0,
              duration: 0.25
            })
          })
          
        })
      }
    } else {
      if(intersects[0].object.name === "p1" && selectedCardHand && viewToggle === true) {
        const cardStats = await getStats(selectedCardHand.cardName);
        if(boardState.get('p1') === "" && cardStats.cost <= 0) {
            playerBoardPosition("p1", selectedCardHand.cardObj, selectedCardHand.handPosition);
            //console.log(selectedCardHand);
            const cardIndex = cardArr.indexOf(selectedCardHand);
            if (cardIndex > -1) {
              cardArr.splice(cardIndex, 1);
            }
            // const card = {}
            const card = boardState.get('p1');
            card.cardName = selectedCardHand.cardName
            card.frontPos = 'AIF1'
            boardState.set('p1', card);
            selectedCardHand = "";
            updateHand();
            //console.log(boardState);
        } else if (cardStats.cost > 0 && boardState.get('p1') !== "" && !selectedCardHand.sacrifice) {
          const boardVal = boardState.get('p1');
          const boardStats = await getStats(boardVal.cardName);
          let cost;
          if (boardStats.cost === 0) {
            cost = 1;
          } else {
            cost = boardStats.cost;
          }
          sacrificeCnt += cost;
          console.log(sacrificeCnt)
          console.log(selectedCardHand);
          killCard('p1', boardVal);
          if (sacrificeCnt >= cardStats.cost){
              console.log('card ready!');
              selectedCardHand.sacrifice = true;
          }
        } else if (boardState.get('p1') === "" && selectedCardHand.sacrifice === true) {
          console.log('got here');
          playerBoardPosition("p1", selectedCardHand.cardObj, selectedCardHand.handPosition);
          //console.log(selectedCardHand);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          // const card = {}
          const card = boardState.get('p1');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF1'
          boardState.set('p1', card);
          selectedCardHand = "";
          updateHand();
          sacrificeCnt = 0;
          //console.log(boardState);
      }
      }

      if(intersects[0].object.name === "p2" && selectedCardHand && viewToggle === true) {
        const cardStats = await getStats(selectedCardHand.cardName);
        if(boardState.get('p2') === "" && cardStats.cost <= 0) {
          playerBoardPosition("p2", selectedCardHand.cardObj, selectedCardHand.handPosition);
          //console.log(selectedCardHand);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          // const card = {}
          const card = boardState.get('p2');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF2'
          boardState.set('p2', card);
          selectedCardHand = "";
          updateHand();
          //console.log(boardState);
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
          console.log(sacrificeCnt)
          console.log(selectedCardHand);
          killCard('p2', boardVal);
          if (sacrificeCnt >= cardStats.cost){
              console.log('card ready!');
              selectedCardHand.sacrifice = true;
          }
        } else if (boardState.get('p2') === "" && selectedCardHand.sacrifice === true) {
          console.log('got here');
          playerBoardPosition("p2", selectedCardHand.cardObj, selectedCardHand.handPosition);
          //console.log(selectedCardHand);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          // const card = {}
          const card = boardState.get('p2');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF2'
          boardState.set('p2', card);
          selectedCardHand = "";
          updateHand();
          sacrificeCnt = 0;
          //console.log(boardState);
        }
      }

      if(intersects[0].object.name === "p3" && selectedCardHand && viewToggle === true) {
        const cardStats = await getStats(selectedCardHand.cardName);
        if(boardState.get('p3') === "" && cardStats.cost <= 0) {
          playerBoardPosition("p3", selectedCardHand.cardObj, selectedCardHand.handPosition);
          //console.log(selectedCardHand);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          // const card = {}
          const card = boardState.get('p3');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF3'
          boardState.set('p3', card);
          selectedCardHand = "";
          updateHand();
          //console.log(boardState);
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
          console.log(sacrificeCnt)
          console.log(selectedCardHand);
          killCard('p3', boardVal);
          if (sacrificeCnt >= cardStats.cost){
              console.log('card ready!');
              selectedCardHand.sacrifice = true;
          }
        } else if (boardState.get('p3') === "" && selectedCardHand.sacrifice === true) {
          console.log('got here');
          playerBoardPosition("p3", selectedCardHand.cardObj, selectedCardHand.handPosition);
          //console.log(selectedCardHand);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          // const card = {}
          const card = boardState.get('p3');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF3'
          boardState.set('p3', card);
          selectedCardHand = "";
          updateHand();
          sacrificeCnt = 0;
          //console.log(boardState);
        }
      }

      if(intersects[0].object.name === "p4" && selectedCardHand && viewToggle === true) {
        const cardStats = await getStats(selectedCardHand.cardName);
        if(boardState.get('p4') === "" && cardStats.cost <= 0) {
          playerBoardPosition("p4", selectedCardHand.cardObj, selectedCardHand.handPosition);
          //console.log(selectedCardHand);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          // const card = {}
          const card = boardState.get('p4');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF4'
          boardState.set('p4', card);
          selectedCardHand = "";
          updateHand();
          //console.log(boardState);
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
          console.log(sacrificeCnt)
          console.log(selectedCardHand);
          killCard('p4', boardVal);
          if (sacrificeCnt >= cardStats.cost){
              console.log('card ready!');
              selectedCardHand.sacrifice = true;
          }
        } else if (boardState.get('p4') === "" && selectedCardHand.sacrifice === true) {
          console.log('got here');
          playerBoardPosition("p4", selectedCardHand.cardObj, selectedCardHand.handPosition);
          //console.log(selectedCardHand);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          // const card = {}
          const card = boardState.get('p4');
          card.cardName = selectedCardHand.cardName
          card.frontPos = 'AIF4'
          boardState.set('p4', card);
          selectedCardHand = "";
          updateHand();
          sacrificeCnt = 0;
          //console.log(boardState);
      }
      }
    } 
  }
}

const updateHand = () => {
    // x for pos1 = -2.25
    // x for pos2 = -1.8
    // x for pos3 = -2.68
    // x for pos4 = -1.35

    if(cardArr.length) {
      if(cardArr[0].handPosition != 1) {
        //console.log("there is no first card!");
        cardArr[0].handPosition = 1;
        cardArr[0].cardObj.parent.position.setX(-2.25);
        const childArr = cardArr[0].cardObj.parent.children
        childArr.forEach(obj => {
          obj.handPosition = 1;
        });
        if(cardArr[1]) {
          cardArr[1].handPosition = 2;
          cardArr[1].cardObj.parent.position.setX(-1.8);
          const childArr = cardArr[1].cardObj.parent.children
          childArr.forEach(obj => {
            obj.handPosition = 2;
          });
        }
        if(cardArr[2]) {
          cardArr[2].handPosition = 3;
          cardArr[2].cardObj.parent.position.setX(-2.68);
          const childArr = cardArr[2].cardObj.parent.children;
          childArr.forEach(obj => {
            obj.handPosition = 3;
          });
        }

      }
      if(cardArr[1] && cardArr[1].handPosition != 2) {
        //console.log("there is no second card!");
        cardArr[1].handPosition = 2;
        cardArr[1].cardObj.parent.position.setX(-1.8);
        const childArr = cardArr[1].cardObj.parent.children
        childArr.forEach(obj => {
          obj.handPosition = 2;
        });
        if(cardArr[2]) {
          cardArr[2].handPosition = 3;
          cardArr[2].cardObj.parent.position.setX(-2.68);
          const childArr = cardArr[2].cardObj.parent.children;
          childArr.forEach(obj => {
            obj.handPosition = 3;
          });
        }
      }
      if(cardArr[2] && cardArr[2].handPosition != 3) {
        //console.log("there is no third card!");
        cardArr[2].handPosition = 3;
        cardArr[2].cardObj.parent.position.setX(-2.68);
        const childArr = cardArr[2].cardObj.parent.children;
        childArr.forEach(obj => {
          obj.handPosition = 3;
        });
      }
    }
}

const playerBoardPosition = function(position, card, handPos) {
  //console.log(handPos);
  const cardObjs = card.parent.children;
  
  if (position === "p1") {
    let boardVal = {cardObj: card};
    //boardVal.cardObj = card;
    boardState.set('p1', boardVal)
    //console.log(boardState);
    cardObjs.forEach(el => {
      //console.log(el.position);
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);

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
    
  })
  } else if (position === "p2") {
    let boardVal = {};
    boardVal.cardObj = card;
    boardState.set('p2', boardVal)
    cardObjs.forEach(el => {
      //console.log(el.position);
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
    })

  } else if (position === "p3") {
    let boardVal = {};
    boardVal.cardObj = card;
    boardState.set('p3', boardVal)
    cardObjs.forEach(el => {
      //console.log(el.position);
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
      //console.log(el.position);
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
}

const toggleView = function() {
  if (viewToggle === false) {
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
}

let cards = [
  'BootStrapped','BrokenCode','Bug','Cookie','DeathNode','destroyEnemy(you)','Documentation','Firewall','Gitbasher','GitSome','GoogleFu','GrimRepo','Hello World','if(losing)','Iterator','JACK','JSONFoorhees','Loop','NullPointer','OffCenterDiv','RobloxDevOps','RubberDuck','SQLSyntaxErr','Syntax Err'
];

let noCostCards = ['OffCenterDiv', 'Hello World', 'Syntax Err', 'Loop', 'if(losing)', 'RobloxDevOps','GoogleFu','GitSome','GrimRepo']

let oppCards = structuredClone(cards);

cards.push('FourOhFour');

const randomCard = (arr) => {
  var index = Math.floor(Math.random()*arr.length-1);
      return arr.splice(index, 1);
}

const deckClick = () => {
  console.log(drawCount);
  if(drawCount < 1) {
    ++drawCount;
    const rCard = randomCard(cards);
    const rCardPath = `./assets/models/Card_models/${rCard}.glb`
    drawCard(rCardPath);
  } else {
    console.log('already drawn!');
  }
}

const drawCard = function(cardPath) {
  let drawCard = deck.scene.children[deck.scene.children.length - 1];
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

  if (deck.scene.children.length == 0) {
    console.log("empty deck");
  }

  // let cardPath = './assets/models/card_merge.glb'
  if (cardArr.length < 4 && deck.scene.children.length != 0) {
    loader.load(`${cardPath}`, (gltf) => {
      const cardObjFormat = {}
      const cardObj = gltf.scene;
        cardObj.traverse(function(object) {
          object.layers.set(2);
        })
        cardObj.layers.set(0);
        cardObj.castShadow = true;
        cardObj.scale.set(0.009,0.009,0.009);
        cardObj.position.setY(6);
        cardObj.position.setZ(-6.6);
        cardObj.rotation.set(-1.57,0,-3.15);
        cardObjFormat.cardObj = gltf.scene.children[1];
        cardObjFormat.cardName = gltf.scene.children[1].name;
        cardObj.children[1].inHand = true;
        cardObj.children[0].inHand = true;

      if(cardArr.length === 0) {
        cardObjFormat.handPosition = 1;
        cardObj.children.forEach(el => {
          el.handPosition = 1;
        })
        //console.log(cardObj.children[0]);
        cardObj.position.setX(-2.25);
        gsap.to(cardObj.position, {
          y: 7.65,
          duration: 0.5
        });    
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
        console.log("Hand full!");
        drawCount = 0;
      }

      cardArr.push(cardObjFormat);
      //console.log(cardObj);
      //console.log(cardArr);
      scene.add(cardObj);
    })
  } else {
    console.log("Hand full!");
    drawCount = 0;
  }
}

const initialHand = () => {
  for(let i=0; i < 2; i++) {
    const rCard = randomCard(noCostCards);
    const rCardPath = `./assets/models/Card_models/${rCard}.glb`
    drawCard(rCardPath);
    const index = cards.indexOf(rCard[0]);
    cards.splice(index, 1);
  }
  for (let i=0; i < 2; i++) {
    const rCard = randomCard(cards);
    const rCardPath = `./assets/models/Card_models/${rCard}.glb`
    drawCard(rCardPath);
    // const testCardPath = './assets/models/Card_models/Bug.glb'
    // drawCard(testCardPath);
  }
}

const randomIntFromInterval = (min, max) => {
  return Math.floor(Math.random() * (max - min + 1) + min)
}

const opponentInitialDraw = () => {
  const rdmInt = randomIntFromInterval(1,4);
  const numPool = [1,2,3,4]
  for(let i=1; i <= rdmInt; i++) {
    var index = Math.floor(Math.random()*numPool.length-1);
    const cardPos = numPool.splice(index, 1);
    const rCard = randomCard(oppCards);
    const rCardPath = `./assets/models/Card_models/${rCard}.glb`;
    //console.log(cardPos);
    opponentPlaceCards(rCardPath, cardPos[0]);
  }
};

const opponentDraw = () => {
// ('AIB1', "");
// ('AIB2', "");
// ('AIB3', "");
// ('AIB4', "");
//console.log("got this far");
  const bs1 = boardState.get('AIB1');
  const bs2 = boardState.get('AIB2');
  const bs3 = boardState.get('AIB3');
  const bs4 = boardState.get('AIB4');
  const numPool = [];

  if(!bs1) {
    //console.log('bs1 is empty');
    numPool.push(1);
  }

  if(!bs2) {
    numPool.push(2);
  }

  if(!bs3) {
    numPool.push(3);
  }

  if(!bs4) {
    numPool.push(4);
  }
  
  if(numPool.length != 0) {
    numPool.forEach(num => {
      //console.log('Flip!!!');
      const coinFlip = Math.floor(Math.random() * 2) == 0;
      if(coinFlip) {
        const rCard = randomCard(oppCards);
        const rCardPath = `./assets/models/Card_models/${rCard}.glb`;
        opponentPlaceCards(rCardPath, num);
      }
    })
  }
};

const opponentPlaceCards = (cardPath, pos) => {
    loader.load(`${cardPath}`, (gltf) => {
      const cardObjFormat = {}
      const cardObj = gltf.scene;
        cardObj.traverse(function(object) {
          object.layers.set(2);
        })
        cardObj.layers.set(0);
        cardObj.castShadow = true;
        cardObj.scale.set(0.016,0.016,0.016);
        cardObj.rotation.set(-3.15,0,-3.15);

        cardObjFormat.cardObj = gltf.scene.children[1];
        cardObjFormat.cardName = gltf.scene.children[1].name;
        if(pos === 1) {
          cardObj.position.setZ(-11.53);
          cardObj.position.setX(-3.18);
          cardObj.position.setY(7.015);
          cardObjFormat.frontPos = 'AIF1'
          cardObjFormat.backPos = 'AIB1'
          boardState.set('AIB1', cardObjFormat);
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
          console.log("invalid position");
        }

      //console.log(boardState);
      //cardArr.push(cardObjFormat);
      scene.add(cardObj);
    })

};

opponentInitialDraw();

const backrowPush = async () => {
  const bs1 = boardState.get('AIB1');
  const bs2 = boardState.get('AIB2');
  const bs3 = boardState.get('AIB3');
  const bs4 = boardState.get('AIB4');
  const statePool = [];
  statePool.push(bs1,bs2,bs3,bs4);

  statePool.forEach(async el => {
    if(el === "") {
      //console.log("empty");
      return;
    } else {
      const frontPosState = boardState.get(el.frontPos);
      if(frontPosState === "") {
        boardState.set(el.frontPos, el);

        if(el.frontPos === 'AIF1') {
          const updatedEl = el;
          updatedEl.frontPos = 'p1';
          boardState.set('AIF1', updatedEl);
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

        const childArr = el.cardObj.parent.children
        childArr.forEach(el => {
          gsap.to(el.position, {
            z: -82,
            duration: 1,
          })
        })
        boardState.set(el.backPos, "");
      }
    }
  })
};

const endTurn = async function() {
//console.log(boardState);
// ('p1', "");
// ('p2', "");
// ('p3', "");
// ('p4', "");

// ('AIF1', "");
// ('AIF2', "");
// ('AIF3', "");
// ('AIF4', "");

// ('AIB1', "");
// ('AIB2', "");
// ('AIB3', "");
// ('AIB4', "");
  //console.log("end turn");
  //console.log(boardState);
  sacrificeCnt = 0;
  drawCount = 0;
  if(cards.length === 0) {
    reshuffleDeck();
  }
  if(oppCards.length === 0) {
    oppCards = [
      'BootStrapped','BrokenCode','Bug','Cookie','DeathNode','destroyEnemy(you)','Documentation','Firewall','Gitbasher','GitSome','GoogleFu','GrimRepo','Hello World','if(losing)','Iterator','JACK','JSONFoorhees','Loop','NullPointer','OffCenterDiv','RobloxDevOps','RubberDuck','SQLSyntaxErr','Syntax Err'
    ];
  }
  toggleView();
  backrowPush();
  setTimeout(async () => {
    turn++;
    if(turn > 0) {
      if(turn % 2 === 0) {
        const coinFlip = Math.floor(Math.random() * 2) == 0;
        if(coinFlip) {
          console.log('Draw!');
          opponentDraw();
        }
      }
      const spots = boardState.keys();
      for await (const spot of spots) {
        const val = boardState.get(spot);
        if(val) {
          //console.log(val);
          //console.log(val.remainingHealth);
          if(val.remainingHealth === 0) {
            console.log('card dies');
            return;
          }
            await dealDamage(spot, val)
        }
      }
    }
  }, 1000);

  // const b1 = boardState.get('AIB1');
  // const b2 = boardState.get('AIB2');
  // const b3 = boardState.get('AIB3');
  // const b4 = boardState.get('AIB4');
  // const f1 = boardState.get('AIF1');
  // const f2 = boardState.get('AIF2');
  // const f3 = boardState.get('AIF3');
  // const f4 = boardState.get('AIF4');

  // // IF ANY backrow slots are occupied
  // if(b1 || b2 || b3 || b4) {
  //   //console.log(b1);

  //   let f1Check;
  //   let f2Check;
  //   let f3Check;
  //   let f4Check;

  //   if(b1) {
  //     //console.log('b1 is occupied');
  //     if(f1) {
  //       f1Check = false;
  //     } else {
  //       f1Check = true;
  //     }
  //   }

  //   if(b2) {
  //     if(f2) {
  //       f2Check = false;
  //     } else {
  //       f2Check = true;
  //     }
  //   }

  //   if(b3) {
  //     if(f3) {
  //       f3Check = false;
  //     } else {
  //       f3Check = true;
  //     }
  //   }

  //   if(b4) {
  //     if(f4) {
  //       f4Check = false;
  //     } else {
  //       f4Check = true;
  //     }
  //   }

  //   //console.log(f1Check);

  //   // if any of the checks are true, then backrow must be pushed
  //   if(f1Check || f2Check || f3Check || f4Check) {
  //     backrowPush();
  //     setTimeout(async () => {
  //       turn++;
  //       if(turn > 0) {
  //         if(turn % 2 === 0) {
  //           const coinFlip = Math.floor(Math.random() * 2) == 0;
  //           if(coinFlip) {
  //             console.log('Draw!');
  //             opponentDraw();
  //           }
  //         }
  //         const spots = boardState.keys();
  //         for await (const spot of spots) {
  //           const val = boardState.get(spot);
  //           if(val) {
  //             //console.log(val);
  //             //console.log(val.remainingHealth);
  //             if(val.remainingHealth === 0) {
  //               console.log('card dies');
  //               return;
  //             }
  //               await dealDamage(spot, val)
  //           }
  //         }
  //       }
  //   }, 1000);
  //   } else {
  //     turn++;
  //     if(turn > 0) {
  //       if(turn % 2 === 0) {
  //         const coinFlip = Math.floor(Math.random() * 2) == 0;
  //         if(coinFlip) {
  //           console.log('Draw!');
  //           opponentDraw();
  //         }
  //       }
  //       const spots = boardState.keys();
  //       for await (const spot of spots) {
  //         const val = boardState.get(spot);
  //         if(val) {
  //           //console.log(val);
  //           //console.log(val.remainingHealth);
  //           if(val.remainingHealth === 0) {
  //             console.log('card dies');
  //             return;
  //           }
  //             await dealDamage(spot, val)
  //         }
  //       }
  //     }
  //   }
  // } else {
  //   turn++;
  //     if(turn > 0) {
  //       if(turn % 2 === 0) {
  //         const coinFlip = Math.floor(Math.random() * 2) == 0;
  //         if(coinFlip) {
  //           console.log('Draw!');
  //           opponentDraw();
  //         }
  //       }
  //       const spots = boardState.keys();
  //       for await (const spot of spots) {
  //         const val = boardState.get(spot);
  //         if(val) {
  //           //console.log(val);
  //           //console.log(val.remainingHealth);
  //           if(val.remainingHealth === 0) {
  //             console.log('card dies');
  //             return;
  //           }
  //             await dealDamage(spot, val)
  //         }
  //       }
  //     }
  // }
};

const animateAttack = (spot) => {
  console.log(spot);
  const spotVal = boardState.get(spot);
  console.log(spotVal);
  if(spot === 'p1' || spot === 'p2' || spot === 'p3' || spot === 'p4') {
    const animateArr = [];
    const parent = spotVal.cardObj.parent
    if(spotVal.textX) {
      const textX = spotVal.textX;
      const textMesh = spotVal.text;
      animateArr.push(textX);
      animateArr.push(textMesh);
    }

    animateArr.push(parent);

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

  } else if (spot === 'AIF1' || spot === 'AIF2' || spot === 'AIF3' || spot === 'AIF4') {
    const animateArr = [];
    const parent = spotVal.cardObj.parent
    if(spotVal.textX) {
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

const dealDamage = async (spot, val) => {
  if (spot === "AIB1" || spot === "AIB2" || spot === "AIB3" || spot === "AIB4") {
    return;
  } else {
    let opponent;
    if (spot === "p1" || spot === "p2" || spot === "p3" || spot === "p4") {
      opponent = 'AI';
    } else {
      opponent = 'player';
    }

    if(val.remainingHealth > 0 || val.remainingHealth === undefined) {
      const valStats = await getStats(val.cardName);
      const frontVal = boardState.get(val.frontPos);
      if(frontVal && valStats.attack > 0) {
        const frontStats = await getStats(frontVal.cardName);
        if(frontVal.remainingHealth) {
          let frontValHealth = frontVal.remainingHealth - valStats.attack
          console.log(frontVal.cardName + " has " + frontValHealth + " health remaining!");
          if(frontValHealth < 0) {
            const cleaveDmg = frontValHealth * -1
            //console.log('deal ' + cleaveDmg + ' to opponent');
            if(opponent === 'AI') {
              AIHealth -= cleaveDmg;
              console.log('AI has ' + AIHealth + ' health left.');
            } else {
              playerHealth -= cleaveDmg;
              console.log('player has ' + playerHealth + ' health left.');
            }
            frontValHealth = 0;
            animateAttack(spot);
            killCard(val.frontPos, frontVal);
            return;
          } else if (frontValHealth === 0) {
            console.log('exact dmg, no cleave done');
            frontValHealth = 0;
            animateAttack(spot);
            killCard(val.frontPos, frontVal);
            return;
          }
          
          frontVal.remainingHealth = frontValHealth;
          boardState.set(val.frontPos, frontVal);
          // HERE IS WHERE WE EXECUTE THE UPDATE CARD FUNC
          updateCard(spot);
          animateAttack(spot);
        } else if (!frontVal.remainingHealth) {
          let frontValHealth = frontStats.defense - valStats.attack
          console.log(frontVal.cardName + " has " + frontValHealth + " health remaining!");
          if(frontValHealth < 0) {
            const cleaveDmg = frontValHealth * -1
            // deal dmg to backrank cards if able
            //console.log('deal ' + cleaveDmg + ' to opponent');
            if(opponent === 'AI') {
              AIHealth -= cleaveDmg;
              console.log('AI has ' + AIHealth + ' health left.');
            } else {
              playerHealth -= cleaveDmg;
              console.log('player has ' + playerHealth + ' health left.');
            }
            frontValHealth = 0;
            killCard(val.frontPos, frontVal);
            animateAttack(spot);
            return;
          } else if (frontValHealth === 0) {
            console.log('exact dmg, no cleave done');
            frontValHealth = 0;
            killCard(val.frontPos, frontVal);
            animateAttack(spot);
            return;
          }
          frontVal.remainingHealth = frontValHealth;
          boardState.set(val.frontPos, frontVal);
          updateCard(spot);
          animateAttack(spot);
        } 
      } else {
        //console.log('direct damage of ' + valStats.attack + ' done to opponent');
        if(opponent === 'AI') {
          AIHealth -= valStats.attack;
          console.log('AI has ' + AIHealth + ' health left.');
        } else {
          playerHealth -= valStats.attack;
          console.log('player has ' + playerHealth + ' health left.');
        }
        animateAttack(spot);
        // deal direct damage to player / opponent
      }
    } else {
      killCard(spot, val);
    }
  }
}

const killCard = (key, val) => {
  console.log(val);
  console.log(val.cardObj);
  gsap.to(val.cardObj.parent.position, {
    y: val.cardObj.parent.position.y - 1,
    duration:2
  })
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

  setTimeout(() => {
    scene.remove(val.cardObj.parent);
    scene.remove(val.textX);
    scene.remove(val.text);
  }, 2000)

  boardState.set(key, "");
}
const getStats = async (name) => {
  const href = window.location.href;
  const response = await fetch(`${href}api/cards/name/${name}`)
  const json = await response.json();
  return json;
}

const reshuffleDeck = () => {
  scene.remove(deck);
  loadDeck();
  cards = [
    'BootStrapped','BrokenCode','Bug','Cookie','DeathNode','destroyEnemy(you)','Documentation','Firewall','Gitbasher','GitSome','GoogleFu','GrimRepo','Hello World','if(losing)','Iterator','JACK','JSONFoorhees','Loop','NullPointer','OffCenterDiv','RobloxDevOps','RubberDuck','SQLSyntaxErr','Syntax Err'
  ];
}
const updateCard = async (spot) => {
  console.log(spot);
  const spotVal = boardState.get(spot);
  const frontPos = spotVal.frontPos;
  const frontVal = boardState.get(frontPos);
  let health;
  let fontSize = 0.2;

  const textAnimate = (spot, el) => {
    if(spot === 'p1' || spot === 'p2' || spot === 'p3' || spot === 'p4') {
      gsap.to(el.position, {
        z: el.position.z - 0.25,
        //y: parent.position.y + 0.05,
        duration: 0.15,
        onComplete: () => {
          gsap.to(el.position, {
            z: el.position.z + 0.25,
            //y: parent.position.y - 0.05,
            duration: 0.15,
            onComplete: () => {
              //scene.remove(frontVal.textX);
              //scene.remove(frontVal.text);
            }
          })
        }
      })
    } else if (spot === 'AIF1' || spot === 'AIF2' || spot === 'AIF3' || spot === 'AIF4') {
      gsap.to(el.position, {
        z: el.position.z - 0.25,
        //y: parent.position.y + 0.05,
        duration: 0.15,
        onComplete: () => {
          gsap.to(el.position, {
            z: el.position.z + 0.25,
            //y: parent.position.y - 0.05,
            duration: 0.15,
            onComplete: () => {
              //scene.remove(frontVal.textX);
              //scene.remove(frontVal.text);
            }
          })
        }
      })
    }
  }

  if(frontVal.textX || frontVal.text) {
    scene.remove(frontVal.textX);
    scene.remove(frontVal.text);
  }

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

  if(frontVal.remainingHealth) {
    health = frontVal.remainingHealth;
    if (health >= 10) {
      fontSize = 0.1;
    }
    //console.log(health);
  }

fontLoader.load(
  './assets/fonts/droid_sans_mono_regular.typeface.json',
  (droidFont) => {
    const textGeometry = new TextGeometry('X', {
      height: 0,
      size: 0.2,
      font: droidFont
    })
    const textMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);
    scene.add(textMesh);
    textMesh.position.setZ(z);
    textMesh.position.setX(x);
    textMesh.position.setY(7.059);
    textMesh.rotation.set(-1.575,0,0);
    frontVal.textX = textMesh;
    textAnimate(spot, textMesh)
  }
);

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

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false)

window.addEventListener('click', raycastClick);

animate();