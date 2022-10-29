import * as THREE from 'three';
import {OrbitControls} from 'OrbitControls';
import {GLTFLoader} from 'GLTFLoader';
import {gsap} from 'GSAP';
import {TextGeometry} from 'TextGeometry';
import {TTFLoader} from 'TTFLoader';
import {FontLoader} from 'FontLoader';

// create card models for all 25 cards
// get random card to hand

let boardState = new Map();

boardState.set('p1', "");
boardState.set('p2', "");
boardState.set('p3', "");
boardState.set('p4', "");

boardState.set('AIF1', "");
boardState.set('AIF2', "");
boardState.set('AIF3', "");
boardState.set('AIF4', "");

boardState.set('AIB1', "");
boardState.set('AIB2', "");
boardState.set('AIB3', "");
boardState.set('AIB4', "");

var clock = new THREE.Clock();
var time = 0;
let obj;
//let currentCard;
let mixer;
let deck;
let cardArr = [];
let selectedCardHand;

const scene = new THREE.Scene();

const gridHelper = new THREE.GridHelper( 100, 100 );
scene.add(gridHelper);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.layers.enable(2);

const renderer = new THREE.WebGL1Renderer({
  canvas: document.querySelector('#bg'),
  antialias: true
});

renderer.setPixelRatio( window.devicePixelRatio );
renderer.setSize( window.innerWidth, window.innerHeight);
renderer.autoClear = false;
renderer.setClearColor(0x000000, 0.0);

camera.position.setX(-2);
camera.position.setY(8.5);
camera.position.setZ(-5);

//camera.lookAt(camera.position);

renderer.render( scene, camera );

const loader = new GLTFLoader();
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
    obj.position.setY(6.98);
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

const raycastClick  = function(event) {
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
      drawCard();
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
      //console.log(intersects[0].object)
      if(intersects[0].object.name === "p1" && selectedCardHand && viewToggle === true) {
        if(boardState.get('p1') === "") {
          playerBoardPosition("p1", selectedCardHand.cardObj, selectedCardHand.handPosition);
          console.log(selectedCardHand);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          boardState.set('p1', selectedCardHand.cardName);
          selectedCardHand = "";
          updateHand();
          //console.log(boardState);
        }
      }

      if(intersects[0].object.name === "p2" && selectedCardHand && viewToggle === true) {
        if(boardState.get('p2') === "") {
          playerBoardPosition("p2", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          boardState.set('p2', selectedCardHand.cardName);
          selectedCardHand = "";
          updateHand();
        }

      }

      if(intersects[0].object.name === "p3" && selectedCardHand && viewToggle === true) {
        if(boardState.get('p3') === "") {
          playerBoardPosition("p3", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          boardState.set('p3', selectedCardHand.cardName);
          selectedCardHand = "";
          updateHand();
        }

      }

      if(intersects[0].object.name === "p4" && selectedCardHand && viewToggle === true) {
        if(boardState.get('p4') === "") {
          playerBoardPosition("p4", selectedCardHand.cardObj, selectedCardHand.handPosition);
          const cardIndex = cardArr.indexOf(selectedCardHand);
          if (cardIndex > -1) {
            cardArr.splice(cardIndex, 1);
          }
          boardState.set('p4', selectedCardHand.cardName);
          selectedCardHand = "";
          updateHand();
        }

      }

    } 

  }

}

const updateHand = function() {
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
    cardObjs.forEach(el => {
      //console.log(el.position);
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);

    if(handPos === 1) {
      gsap.to(el.position, {
        y: -240,
        z: -70,
        x: 107,
        duration: 1
      })
    } else if (handPos === 2) {
      gsap.to(el.position, {
        y: -240,
        z: -70,
        x: 157,
        duration: 1
      })
    } else if (handPos === 3) {
      gsap.to(el.position, {
        y: -240,
        z: -70,
        x: 60,
        duration: 1
      })
    } else if (handPos === 4) {
      gsap.to(el.position, {
        y: -240, 
        z: -70,
        x: 207,
        duration: 1
      })
    }
    
  })
  } else if (position === "p2") {
    cardObjs.forEach(el => {
      //console.log(el.position);
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);

      if (handPos === 1) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: 18,
          duration: 1
        });
      } else if (handPos === 2) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: 68,
          duration: 1
        });
      } else if (handPos === 3) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -28,
          duration: 1
        });
      } else if (handPos === 4) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: 118,
          duration: 1
        })
      }
    })

  } else if (position === "p3") {
    cardObjs.forEach(el => {
      //console.log(el.position);
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);
  
      if (handPos === 1) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -71,
          duration: 1
        });
      } else if (handPos === 2) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -20,
          duration: 1
        });
      } else if (handPos === 3) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -118,
          duration: 1
        });
      } else if (handPos === 4) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: 27,
          duration: 1
        })
      }
    })
  } else if (position === "p4") {
    cardObjs.forEach(el => {
      //console.log(el.position);
      el.rotation.set(3.15,0,0);
      el.scale.set(1.65,1.45,1.65);
  
      if (handPos === 1) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -160,
          duration: 1
        });
      } else if (handPos === 2) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -110,
          duration: 1
        });
      } else if (handPos === 3) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -208,
          duration: 1
        });
      } else if (handPos === 4) {
        gsap.to(el.position, {
          y: -240,
          z: -70,
          x: -60,
          duration: 1
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

const drawCard = function() {
  let drawCard = deck.scene.children[deck.scene.children.length - 1];
  if (cardArr.length < 4) {
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
  let cardPath = './assets/models/card_merge.glb'
  if (cardArr.length < 4) {
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
      }

      cardArr.push(cardObjFormat);
      //console.log(cardObj);
      //console.log(cardArr);
      scene.add(cardObj);
    })
  } else {
    console.log("Hand full!");
  }
}

const endTurn = function() {
  console.log("end turn");
}

// const fontLoader = new FontLoader();
// fontLoader.load(
//   './assets/fonts/droid_sans_mono_regular.typeface.json',
//   (droidFont) => {
//     const textGeometry = new TextGeometry('FatalErr', {
//       height: 0,
//       size: 0.09,
//       font: droidFont
//     })
//     const textMaterial = new THREE.MeshBasicMaterial({color: 0x000000});
//     const textMesh = new THREE.Mesh(textGeometry, textMaterial);
//     scene.add(textMesh);
//     textMesh.position.setZ(-9.28);
//     textMesh.position.setX(-1);
//     textMesh.position.setY(7.016);
//     textMesh.rotation.set(-1.575,0,0);
//   }
// );

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}, false)

window.addEventListener('click', raycastClick);

animate();