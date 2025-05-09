const SCALE = 3;
const CELL_LENGTH = 22;
const MOVE_DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

const canvas = document.querySelector("canvas");
const context = canvas.getContext("2d");
let maxRows = 10;
let maxCols = 10;

/**
 * @typedef AnimationData
 * @type {object}
 * @property {string} name
 * @property {number} frameWidth
 * @property {number} frameHeight
 * @property {number[]} durations
 * @property {ImageBitmap[][]} animSprites
 */

/**
 * @typedef Vector2D
 * @type {object}
 * @property {number} x
 * @property {number} y
 */

/** Animated sprite. */
class AnimatedSprite {
    /**
     * Constructor for an animated sprite
     * @param {AnimationData[]} animations
     */
    constructor(animations) {
        this.animations = animations;
        this.currentAnimation = animations[0];

        this.frameIndex = 0;
        this.rowIndex = 0;
        this.remainingFrameDuration = 0;

        this.paused = true;
    }

    /**
     * Updates row index in current sprite sheet
     * @param {number} rowIndex
     */
    setRow(rowIndex) {
        if (rowIndex >= this.rowCount()) {
            throw new Error(`Row ${rowIndex} is out of range for animation ${this.animationIndex}.`);
        }
        this.rowIndex = rowIndex;
    }

    /**
     * Updates current animation being played 
     * @param {string} animationId
     */
    play(animationId) {
        const index = this.animations.findIndex(animation => animation.name === animationId);
        if (index === -1) {
            throw new Error(`Failed to find animation with name ${animationId}`);
        }
        this.currentAnimation = this.animations[index];
        if (this.rowIndex >= this.rowCount()) {
            this.setRow(0);
        }
        this.resetPlayback();
        this.paused = false;
    }

    stop() {
        this.paused = true;
    }

    resetPlayback() {
        this.frameIndex = 0;
        this.remainingFrameDuration = this.currentAnimation.durations[0];
    }

    update() {
        if (this.paused) {
            return;
        }
        this.remainingFrameDuration--;
        if (this.isEndReached()) {
            return;
        }
        if (this.remainingFrameDuration <= 0) {
            this.frameIndex++;
            this.remainingFrameDuration = this.currentAnimation.durations[this.frameIndex];
            return;
        }
    }

    /**
     * Returns true if the playback reached the end.
     * @returns {boolean}
     */
    isEndReached() {
        return this.remainingFrameDuration <= 0 && this.frameIndex === this.currentAnimation.durations.length - 1;
    }

    /**
     * Renders sprite at given x, y position
     * @param {number} x
     * @param {number} y
     */
    render(x, y) {
        const sprite = this.currentAnimation.animSprites[this.rowIndex][this.frameIndex];
        const width = this.currentAnimation.frameWidth;
        const height = this.currentAnimation.frameHeight;
        context.drawImage(sprite, x - width / 2, y - height / 2, width, height);
    }

    rowCount() {
        return this.currentAnimation.animSprites.length;
    }
}

/** Pokemon AI */
class Pokemon {
    /**
     * Constructor for Pokemon entity.
     * @param {number} row
     * @param {number} col
     * @param {AnimatedSprite} animatedSprite
     */
    constructor(row, col, animatedSprite) {
        this.updateGridPosition(row, col);
        this.sprite = animatedSprite;
        this.nextState();
    }

    update() {
        this.actionTimer++;
        this.sprite.update();
        if (this.isPickedUp) {
            if (this.sprite.isEndReached()) {
                this.sprite.resetPlayback();
            }
            return;
        }
        if (this.actionTimer >= this.actionDuration) {
            this.nextState();
        }
        if (this.sprite.isEndReached() && this.moveRepeats > 0) {
            this.move();
            this.moveRepeats--;
        }
    }

    render() {
        if (this.prevPosition) {
            const t = this.actionTimer / this.actionDuration;
            this.sprite.render(
                this.prevPosition.x * (1 - t) + this.position.x * t,
                this.prevPosition.y * (1 - t) + this.position.y * t
            );
        } else {
            this.sprite.render(this.position.x, this.position.y);
        }
    }

    pickUp() {
        this.isPickedUp = true;
        this.prevPosition = undefined;
        this.sprite.play("Cringe");
        this.sprite.setRow(0);
        this.actionTimer = 0;
        this.actionDuration = this.sprite.currentAnimation.durations.reduce((duration, acc) => acc + duration, 0);
    }

    place(row, col) {
        this.updateGridPosition(row, col);
        this.nextState();
    }

    nextState() {
        this.isPickedUp = false;
        this.prevPosition = undefined;

        if (Math.random() < 0.5) {
            this.moveRepeats = 1 + Math.floor(Math.random() * 2); // 1 to 3 repeats
            if (this.row <= 1) {
                this.directionIndex = 0;
            } else if (this.col <= 1) {
                this.directionIndex = 2;
            } else if (this.row >= maxRows - 1) {
                this.directionIndex = 4;
            } else if (this.col >= maxCols - 1) {
                this.directionIndex = 6;
            } else {
                this.directionIndex = Math.floor(Math.random() * MOVE_DIRECTIONS.length);
            }
            this.move();
        } else {
            this.sprite.play("Idle");
            this.actionTimer = 0;
            this.actionDuration = this.sprite.currentAnimation.durations.reduce((duration, acc) => acc + duration, 0);
        }
    }

    move() {
        this.sprite.play("Walk");
        this.sprite.setRow(this.directionIndex);
        this.actionTimer = 0;
        this.actionDuration = this.sprite.currentAnimation.durations.reduce((duration, acc) => acc + duration, 0);

        this.prevPosition = this.position;
        const [deltaRow, deltaCol] = MOVE_DIRECTIONS[this.directionIndex];
        this.updateGridPosition(this.row + deltaRow, this.col + deltaCol);
    }

    /**
     * Updates current position of Pokemon.
     * @param {number} row
     * @param {number} col
     */
    updateGridPosition(row, col) {
        this.row = row;
        this.col = col;
        this.position = toCoordinate(row, col);
    }
}

function drawGrid() {
    const width =  maxCols * CELL_LENGTH;
    const height = maxRows * CELL_LENGTH;

    for (let x = CELL_LENGTH; x <= width; x += CELL_LENGTH) {
        context.beginPath();
        context.moveTo(x, CELL_LENGTH);
        context.lineTo(x, height)
        context.stroke();
    }

    for (let y = CELL_LENGTH; y <= height; y += CELL_LENGTH) {
        context.beginPath();
        context.moveTo(CELL_LENGTH, y);
        context.lineTo(width, y)
        context.stroke();
    }
}

/**
 * Loads animation data and sprites for the given pokemon.
 * @param {string} pokemonName
 * @returns {Promise<AnimationData[]>}
 */
async function loadAnimation(pokemonName) {
    const response = await fetch(`/pokesprites/${pokemonName}/AnimData.xml`);
    const parser = new DOMParser();
    const xml = parser.parseFromString(await response.text(), "text/xml");
    const anims = xml.querySelectorAll("Anims > Anim");

    /** @type {AnimationData[]} */
    const animations = [];

    /** @type {Promise<ImageBitmap[][]>[]} */
    const spritePromises = [];

    for (let anim of anims) {
        /** @type {AnimationData} */
        const animation = {};

        for (let attribute of anim.childNodes) {
            switch (attribute.tagName) {
                case "Name":
                    animation.name = attribute.firstChild.nodeValue;
                    break;
                case "FrameWidth":
                    animation.frameWidth = Number(attribute.firstChild.nodeValue);
                    break;
                case "FrameHeight":
                    animation.frameHeight = Number(attribute.firstChild.nodeValue);
                    break;
                case "Durations":
                    animation.durations = [];
                    for (let duration of attribute.childNodes) {
                        if (duration.tagName === "Duration") {
                            animation.durations.push(Number(duration.firstChild.nodeValue));
                        }
                    }
                    break;
                default:
            }
        }

        if (animation.name) {
            const spritePromise = loadSprites(
                `/pokesprites/${pokemonName}/${animation.name}-Anim.png`,
                animation.frameWidth,
                animation.frameHeight
            );
            animations.push(animation);
            spritePromises.push(spritePromise);
        }
    }

    const spriteMatrices = await Promise.all(spritePromises);
    for (let i = 0; i < animations.length; i++) {
        animations[i].animSprites = spriteMatrices[i];
    }

    return animations;
}

/**
 * Loads spritesheet at the given path.
 * @param {string} path 
 * @returns {number} frameWidth
 * @returns {number} frameHeight
 * @returns {Promise<ImageBitmap[][]>}
 */
async function loadSprites(path, frameWidth, frameHeight) {
    const image = new Image();
    return new Promise((resolve, reject) => {
        image.onload = () => {
            const framePromises = [];
            const rows = Math.floor(image.height / frameHeight);
            const cols = Math.floor(image.width / frameWidth);
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    const bitmap = createImageBitmap(image, frameWidth * j, frameHeight * i, frameWidth, frameHeight);
                    framePromises.push(bitmap);
                }
            }
            resolve(Promise.all(framePromises).then(frames => {
                const frameMatrix = [];
                for (let i = 0; i < rows; i++) {
                    const row = [];
                    for (let j = 0; j < cols; j++) {
                        row.push(frames[i * cols + j]);
                    }
                    frameMatrix.push(row);
                }
                return frameMatrix;
            }));
        };
        image.onerror = () => {
            reject(`Could not load image`);
        };
        image.src = path;
    });
}

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    maxRows = Math.floor(canvas.height / (CELL_LENGTH * SCALE));
    maxCols = Math.floor(canvas.width / (CELL_LENGTH * SCALE));
}

/**
 * Returns a Vector2D coordinate for a given grid index
 * @param {number} row 
 * @param {number} col 
 * @returns {Vector2D}
 */
function toCoordinate(row, col) {
    return {
        x: (col + 0.5) * CELL_LENGTH,
        y: (row + 0.5) * CELL_LENGTH
    };
}

window.addEventListener("resize", () => {
    resize();
});

document.addEventListener("DOMContentLoaded", () => {
    resize();
});

async function main() {
    const pokemonNames = ["Gengar", "Misdreavus", "Litwick", "Clodsire"];
    const animDataList = await Promise.all(pokemonNames.map(name => loadAnimation(name)));

    /** @type {Pokemon} */
    let selectedPokemon;

    /** @type {Pokemon[]} */
    const entities = [];
    for (let i = 0; i < 10; i++) {
        const row = 1 + Math.floor(Math.random() * (maxRows - 2));
        const col = 1 + Math.floor(Math.random() * (maxCols - 2));
        const animData = animDataList[Math.floor(Math.random() * animDataList.length)];
        entities.push(new Pokemon(row, col, new AnimatedSprite(animData)));
    }

    /**
     * Pick up pokemon
     * @param {number} x 
     * @param {number} y
     */
    function pickUp(x, y) {
        const row = Math.floor(y / (CELL_LENGTH * SCALE));
        const col = Math.floor(x / (CELL_LENGTH * SCALE));
        const pokemon = entities.find(pokemon => pokemon.row === row && pokemon.col === col);
        if (pokemon) {
            canvas.style.cursor = "pointer";
            selectedPokemon = pokemon;
            selectedPokemon.pickUp();
            selectedPokemon.position.x = x / SCALE;
            selectedPokemon.position.y = y / SCALE;
        }
    }

    /**
     * Moves selected pokemon
     * @param {number} x 
     * @param {number} y 
     */
    function movePokemon(x, y) {
        if (selectedPokemon) {
            selectedPokemon.position.x = x / SCALE;
            selectedPokemon.position.y = y / SCALE;
        }
    }

    function setDown() {
        canvas.style.cursor = "default";
        if (selectedPokemon) {
            const row = Math.round(selectedPokemon.position.y / CELL_LENGTH - 0.5);
            const col = Math.round(selectedPokemon.position.x / CELL_LENGTH - 0.5);
            selectedPokemon.place(row, col);
            selectedPokemon = undefined;
        }
    }

    canvas.addEventListener("mousedown", (event) => {
        pickUp(event.clientX, event.clientY);
    });

    canvas.addEventListener("touchstart", (event) => {
        pickUp(event.touches[0].clientX, event.touches[0].clientY);
    });

    canvas.addEventListener("mousemove", (event) => {
        movePokemon(event.clientX, event.clientY);
    });

    canvas.addEventListener("touchmove", (event) => {
        movePokemon(event.touches[0].clientX, event.touches[0].clientY);
    });

    canvas.addEventListener("mouseup", () => {
        setDown();
    });

    canvas.addEventListener("mouseleave", () => {
        setDown();
    });

    canvas.addEventListener("touchend", () => {
        setDown();
    });

    canvas.addEventListener("touchcancel", () => {
        setDown();
    });

    function update() {
        context.save();
        context.imageSmoothingEnabled = false;
        context.scale(SCALE, SCALE);

        // Update
        for (let entity of entities) {
            entity.update();
        }

        // Render
        context.clearRect(0, 0, canvas.width, canvas.height);
        if (selectedPokemon) {
            const row = Math.round(selectedPokemon.position.y / CELL_LENGTH - 0.5);
            const col = Math.round(selectedPokemon.position.x / CELL_LENGTH - 0.5);
            context.fillStyle = "rgba(0, 255, 0, 0.4)";
            context.fillRect(
                col * CELL_LENGTH,
                row * CELL_LENGTH,
                CELL_LENGTH,
                CELL_LENGTH
            );
        }
        drawGrid();
        for (let entity of entities) {
            entity.render();
        }

        context.restore();
        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

main();
