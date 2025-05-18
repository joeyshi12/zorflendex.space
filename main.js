const SCALE = 3;
const CELL_LENGTH = 22;
const MOVE_DIRECTIONS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const MIN_DELTA_TIME = 16;
const POKEMON_IDS = ["000", "001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011", "012", "013", "014", "016", "017", "018", "019", "020", "021", "022", "023", "024", "025", "026", "027", "028", "029", "030", "031", "032", "033", "034", "035", "036", "037", "038", "039", "040", "041", "042", "043", "044", "045", "046", "047", "048", "049", "050", "051", "052", "053", "054", "055", "056", "057", "058", "059", "060", "061", "062", "063", "064", "065", "066", "067", "068", "069", "070", "071", "072", "073", "074", "075", "076", "077", "078", "079", "080", "081", "082", "083", "084", "085", "086", "087", "088", "089", "090", "091", "092", "093", "094", "095", "096", "097", "098", "099", "100", "101", "102", "103", "104", "105", "106", "107", "108", "109", "110", "111", "112", "113", "114", "115", "116", "117", "118", "119", "120", "121", "122", "123", "124", "125", "126", "127", "128", "129", "130", "131", "132", "133", "134", "135", "136", "137", "138", "139", "140", "141", "142", "143", "144", "145", "146", "147", "149", "150", "151", "980"]
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
        this.sprite.play("Hurt");
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

/**
 * Returns k random elements from arr without replacement
 * @param {any[]} arr
 * @param {number} k
 */
function chooseRandom(arr, k) {
    const shuffled = arr.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, k);
}

window.addEventListener("resize", () => {
    resize();
});

document.addEventListener("DOMContentLoaded", () => {
    resize();
});

async function main() {
    const pokemonIds = chooseRandom(POKEMON_IDS, 8);
    const animDataList = await Promise.all(pokemonIds.map(name => loadAnimation(name)));
    let previousTime = 0;

    /** @type {Pokemon} */
    let selectedPokemon;

    /** @type {Pokemon[]} */
    const entities = [];
    for (let index in pokemonIds) {
        const row = 1 + Math.floor(Math.random() * (maxRows - 2));
        const col = 1 + Math.floor(Math.random() * (maxCols - 2));
        const animData = animDataList[index];
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
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.pageX - rect.left;
        const mouseY = event.pageY - rect.top;
        pickUp(mouseX, mouseY);
    });

    canvas.addEventListener("touchstart", (event) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.touches[0].clientX - rect.left;
        const mouseY = event.touches[0].clientY - rect.top;
        pickUp(mouseX, mouseY);
    });

    canvas.addEventListener("mousemove", (event) => {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.pageX - rect.left;
        const mouseY = event.pageY - rect.top;
        movePokemon(mouseX, mouseY);
    });

    canvas.addEventListener("touchmove", (event) => {
        event.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.touches[0].clientX - rect.left;
        const mouseY = event.touches[0].clientY - rect.top;
        movePokemon(mouseX, mouseY);
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

    /**
     * Update function
     * @param {number} time 
     */
    function update(time) {
        const deltaTime = time - previousTime;

        if (deltaTime > MIN_DELTA_TIME) {
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
            previousTime = time;
        }

        requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
}

main();
