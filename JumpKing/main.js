let canvas;
let gfx;

const WIDTH = 1000;
const HEIGHT = 800;
const volume = .3;
let isMuted = false;
let isCollision = false;

let previousTime = 0;
let currentTime = 0;
let passedTime = 0;
let msPerFrame = 1000.0 / 144.0;

const numResource = 3;
let resourceLoaded = 0;

let songa = false;
let audios = {};
let images = {};
let keys = {};
let blocks = [];

const speed = 2;
const gravity = 0.19;
const globalFriction = 1;
const groundFriction = .6;
const sideJump = 4;
const boundFriction = .7;
const JumpConst = 12.0;
const chargingConst = 700.0;

let player;
let level = 0;
let levelMax = 0;

class Blocks
{
    constructor(x, y, w, h)
    {
        this.x = x;
        this.y = y;
        this.X = x + w;
        this.Y = y + h;
        this.width = w;
        this.height = h;
    }

    checkCollidePoint(px, py)
    {
        if (px > this.x && px < this.X && py > this.y && py < this.Y)
            return true;
        else
            return false;
    }

    checkCollideBox(box)
    {
        let rlb = this.checkCollidePoint(box.x, box.y);
        let rrb = this.checkCollidePoint(box.X, box.y);
        let rlt = this.checkCollidePoint(box.x, box.Y);
        let rrt = this.checkCollidePoint(box.X, box.Y);

        let res =
        {
            collide: rlb || rrb || rlt || rrt,
            lb: rlb,
            rb: rrb,
            lt: rlt,
            rt: rrt,
        };

        return res;
    }

    move(dx, dy)
    {
        this.x += dx;
        this.y += dy;
        this.X += dx;
        this.Y += dy;
    }
}

class Block
{
    constructor(level, place)
    {
        this.level = level;
        this.aabb = place;
    }

    convert()
    {
        return new Blocks(this.aabb.x, this.aabb.y + this.level * HEIGHT, this.aabb.width, this.aabb.height);
    }
}

class Player
{
    constructor(x, y)
    {
        this.crouching = false;
        this.onGround = true;
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.size = 64;
        this.radius = this.size / 2.0 * 1.414;
        this.jumpGauge = 0;
        this.way = 1;
    }

    aabb()
    {
        return new Blocks(this.x, this.y, this.size, this.size);
    }

    getCenter()
    {
        let res =
        {
            x: this.x + 32,
            y: this.y + 35
        }

        return res;
    }

    getDrawImage()
    {
        if (this.crouching)
            return 'crouch';
        else
            return this.way === 0 ? "left" : "right";
    }

    collideToLeft(w)
    {
        this.x = w;
        this.vx *= -1 * boundFriction;
        audios.bounce.start();
    }

    collideToRight(w)
    {
        this.x = w - this.size;
        this.vx *= -1 * boundFriction;
        audios.bounce.start();
    }

    collideToTop(w)
    {
        this.y = w - this.size;
        this.vy *= -1 * boundFriction;
        audios.bounce.start();
    }

    collideToBottom(w)
    {
        this.onGround = true;
        this.y = w;
        this.vx = 0;
        this.vy = 0;
        if (isCollision)
        {
            keys.ArrowLeft = false;
            keys.ArrowRight = false;
        }
        audios.landing.start();
    }

    collideToWall(s, r)
    {
        this.x = s.x;
        this.y = s.y;
        this.vx = r.x * boundFriction;
        this.vy = r.y;
        audios.bounce.start();
    }
    
    update(delta)
    {
        //Apply previous acceleration
        this.vx *= globalFriction;
        this.vy *= globalFriction;
        if (Math.abs(this.vx) < 0.0001) this.vx = 0;
        if (Math.abs(this.vy) < 0.0001) this.vy = 0;
        this.x += this.vx;
        this.y += this.vy;

        let c;

        //Calculate current level
        level = Math.trunc(this.y / HEIGHT);
        levelMax = level > levelMax ? level : levelMax;

        // let moving = this.vx * this.vx + this.vy + this.vy;
        // let falling = this.vy < 0 ? true : false;
        if(!songa && (keys.ArrowLeft || keys.ArrowRight || keys[' '])){
            songa = true;
            audios.song.play();
            audios.song.volume = 0.5;
            console.log("had");
        }
        if (this.onGround)
        {
            this.vx *= groundFriction;

            if (keys[' '] && !this.crouching)
            {
                this.crouching = true;
            }
            else if (keys[' '] && this.crouching)
            {
                this.jumpGauge >= 1 ? this.jumpGauge = 1 : this.jumpGauge += delta / chargingConst;
            }
            else if (keys.ArrowLeft && !this.crouching)
            {
                c = this.testCollide(-speed, 0);
                this.way = 0;
                if (c.side == undefined)
                    this.vx = -speed;
                else
                    this.vx = 0;
            }
            else if (keys.ArrowRight && !this.crouching)
            {
                c = this.testCollide(speed, 0);
                this.way = 1;
                if (c.side == undefined)
                    this.vx = speed;
                else
                    this.vx = 0;
            }
            else if (!keys[' '] && this.crouching)
            {
                if (keys.ArrowLeft) {
                    this.vx = -sideJump;
                    this.way = 0;
                }
                else if (keys.ArrowRight) {
                    this.vx = sideJump;
                    this.way = 1;
                }
                

                this.vy = this.jumpGauge * JumpConst;
                this.jumpGauge = 0;
                this.onGround = false;
                this.crouching = false;
            }
        }

        //Apply gravity
        c = this.testCollide(0, -gravity);
        if (c.side == undefined)
        {
            this.vy -= gravity;
            this.onGround = false;
        }

        //Test if current acceleration make collision happen or not 
        c = this.testCollide(this.vx, this.vy);
        if (c.side != undefined)
        {
            if (c.side != 'error')
                this.reponseCollide(c);
        }

    }

    testCollide(nvx, nvy)
    {
        let side;
        let set;

        let box = this.aabb();
        box.move(nvx, nvy);

        if (box.x < 0)
        {
            side = 'left';
            set = 0;
        }
        else if (box.X > WIDTH)
        {
            side = 'right';
            set = WIDTH;
        }
        else if (box.y < 0)
        {
            side = 'bottom';
            set = 0;
        }
        else
        {
            for (let b of blocks)
            {
                if (b.level != level) continue;

                let aabb = b.convert();
                let r = aabb.checkCollideBox(box);

                if (r.collide)
                {
                    if (r.lb && r.lt)
                    {
                        side = 'left';
                        set = aabb.X;
                    }
                    else if (r.rb && r.rt)
                    {
                        side = 'right';
                        set = aabb.x;
                    }
                    else if (r.lb && r.rb)
                    {
                        side = 'bottom';
                        set = aabb.Y;
                    }
                    else if (r.lt && r.rt)
                    {
                        side = 'top';
                        set = aabb.y;
                    }
                    else if (r.lb)
                    {
                        let bx = box.x - this.vx;
                        if (bx > aabb.X)
                        {
                            side = 'left';
                            set = aabb.X;
                        }
                        else
                        {
                            side = 'bottom';
                            set = aabb.Y;
                        }
                    }
                    else if (r.rb)
                    {
                        let bx = box.X - this.vx;
                        if (bx < aabb.x)
                        {
                            side = 'right';
                            set = aabb.x;
                        }
                        else
                        {
                            side = 'bottom';
                            set = aabb.Y;
                        }
                    }
                    else if (r.lt)
                    {
                        let bx = box.x - this.vx;
                        if (bx > aabb.X)
                        {
                            side = 'left';
                            set = aabb.X;
                        }
                        else
                        {
                            side = 'top';
                            set = aabb.y;
                        }
                    }
                    else if (r.rt)
                    {
                        let bx = box.X - this.vx;
                        if (bx < aabb.x)
                        {
                            side = 'right';
                            set = aabb.x;
                        }
                        else
                        {
                            side = 'top';
                            set = aabb.y;
                        }
                    }

                    return { side, set };
                }
            }
        }

        return { side, set };
    }

    reponseCollide(c)
    {
        switch (c.side)
        {
            case 'left':
                this.collideToLeft(c.set);
                break;
            case 'right':
                this.collideToRight(c.set);
                break;
            case 'bottom':
                this.collideToBottom(c.set);
                break;
            case 'top':
                this.collideToTop(c.set);
                break;
            case 'wall':
                this.collideToWall(c.set, c.ref);
                break;

        }
    }

    render()
    {
        if(this.getDrawImage()){

        }
        gfx.drawImage(images[this.getDrawImage()], this.x, HEIGHT - this.size - this.y + level * HEIGHT, this.size, this.size);

        gfx.beginPath();
        gfx.rect(941, HEIGHT - 779, 52, -14);
        gfx.stroke();
        drawBlock(942, 780, Math.trunc(player.jumpGauge * 50), 12);
    }
}

window.onload = async function ()
{
    await init();
    await initLevels();
    run();
};

 function init()
{
    try{
        canvas = document.getElementById("canvas");
        gfx = canvas.getContext("2d");
        gfx.font = "20px Georgia";
        gfx.lineWidth = 2;
    
        document.onkeydown = keyDown;
        document.onkeyup = keyUp;
    
        previousTime = new Date().getTime();
    
        //Images 
        images.left = new Image();
        images.left.src = "./images/left.png";
        images.left.onload = function () { resourceLoaded++; };
        images.right = new Image();
        images.right.src = "./images/right.png";
        images.right.onload = function () { resourceLoaded++; };
        images.crouch = new Image();
        images.crouch.src = "./images/crouch.png";
        images.crouch.onload = function () { resourceLoaded++; };
        audios.landing = new Audio();
        audios.landing.src = "./audios/landing.wav";
        audios.landing.volume = volume;
        audios.song = new Audio();
        audios.song.src = "./audios/song.mp3";
        audios.bounce = new Audio();
        audios.bounce.src = "./audios/bounce.wav";
        audios.bounce.volume = volume;
        audios.jump = new Audio();
        audios.jump.volume = volume;
    
        audios.landing.start = function ()
        {
            if (isMuted) return;
            audios.landing.pause();
            audios.landing.currentTime = 0;
            audios.landing.play();
        };
        audios.bounce.start = function ()
        {
            if (isMuted) return;
            audios.bounce.pause();
            audios.bounce.currentTime = 0;
            audios.bounce.play();
        };
        audios.jump.start = function ()
        {
            if (isMuted) return;
            audios.jump.pause();
            audios.jump.currentTime = 0;
            audios.jump.play();
        };
        player = new Player((WIDTH - 32) / 2.0, 0);
        // player = new Player(833, HEIGHT * 2 + 690);
    
            return 1;
    }
    catch(error){
        console.log(error)
    }
    
}
   


//Make game levels
function initLevels()
{
    //blocks.push(new Block(0, new Blocks(0, 0, 300, 300)));

    blocks.push(new Block(0, new Blocks(600, 70, 200, 50)));
    blocks.push(new Block(0, new Blocks(850, 300, 150, 50)));
    blocks.push(new Block(0, new Blocks(400, 300, 200, 50)));
    blocks.push(new Block(0, new Blocks(200, 440, 200, 50)));
    blocks.push(new Block(0, new Blocks(0, 750, 200, 50)));

    blocks.push(new Block(1, new Blocks(0, 0, 150, 70)));
    blocks.push(new Block(1, new Blocks(530, 200, 100, 40)));
    blocks.push(new Block(1, new Blocks(800, 200, 100, 40)));
    blocks.push(new Block(1, new Blocks(630, 540, 180, 90)));
    blocks.push(new Block(1, new Blocks(770, 540, 90, 40)));

    blocks.push(new Block(2, new Blocks(130, 10, 100, 45)));
    blocks.push(new Block(2, new Blocks(130, 300, 100, 45)));
    blocks.push(new Block(2, new Blocks(540, 400, 70, 30)));
    blocks.push(new Block(2, new Blocks(800, 480, 70, 30)));

    blocks.push(new Block(3, new Blocks(460, 10, 110, 40)));
    blocks.push(new Block(3, new Blocks(46, 236, 100, 40)));
    blocks.push(new Block(3, new Blocks(890, 550, 70, 40)));
    blocks.push(new Block(3, new Blocks(450, 450, 70, 40)));

    blocks.push(new Block(4, new Blocks(450, 10, 90, 40)));
    blocks.push(new Block(4, new Blocks(100, 20, 70, 200)));
    blocks.push(new Block(4, new Blocks(500, 380, 70, 200)));
    blocks.push(new Block(4, new Blocks(850, 680, 70, 40)));

    blocks.push(new Block(5, new Blocks(500, 100, 99, 40)));
    blocks.push(new Block(5, new Blocks(900, 250, 190, 40)));
    blocks.push(new Block(5, new Blocks(400, 350, 80, 40)));
    blocks.push(new Block(5, new Blocks(0, 600, 80, 40)));
    blocks.push(new Block(5, new Blocks(0, 600, 80, 40)));

    blocks.push(new Block(6, new Blocks(330, 130, 80, 40)));
    blocks.push(new Block(6, new Blocks(410, 130, 34, 200)));
    blocks.push(new Block(6, new Blocks(50, 400, 100, 40)));
    blocks.push(new Block(6, new Blocks(500, 500, 100, 40)));
    blocks.push(new Block(6, new Blocks(850, 600, 100, 40)));

    blocks.push(new Block(7, new Blocks(100, 300, 100, 40)));
    blocks.push(new Block(7, new Blocks(520, 30, 70, 40)));
    blocks.push(new Block(7, new Blocks(877, 600, 70, 40)));
    blocks.push(new Block(7, new Blocks(600, 550, 70, 40)));
    console.log(images)
    return 1;
}

function keyDown(e)
{
    keys[e.key] = true;
    // console.log(e);
}

function keyUp(e)
{
    keys[e.key] = false;
}

function run(time)
{
    let currentTime = new Date().getTime();
    passedTime += currentTime - previousTime;
    previousTime = currentTime;

    while (passedTime >= msPerFrame)
    {
        update(msPerFrame);
        render();
        passedTime -= msPerFrame;
    }

    requestAnimationFrame(run);
}

function update(delta)
{
    player.update(delta);
}

function render()
{
    if (resourceLoaded != numResource)
        return;

    gfx.clearRect(0, 0, WIDTH, HEIGHT);

    player.render();

    blocks.forEach(b =>
    {
        if (b.level != level) return;

        drawAABB(b.aabb);
    });

    if (levelMax == 0)
    {
    }
    if (level == 7)
    {
        gfx.fillText("GOAL!", 880, HEIGHT - 700);
        gfx.fillText("THX FOR PLAYING DUDE!", 810, HEIGHT - 550);
    }
}

function drawAABB(draw)
{
    drawBlock(draw.x, draw.y, draw.width, draw.height);
}

function drawBlock(x, y, w, h)
{
    gfx.beginPath();
    gfx.rect(x, HEIGHT - y, w, -h);
    gfx.fill();
}

function getTouchPos(canvas, evt)
{
    let rect = canvas.getBoundingClientRect();
    return {
        x: Math.trunc(evt.touches[0].clientX - rect.left),
        y: HEIGHT - Math.trunc(evt.touches[0].clientY - rect.top)
    };
}

function getIntersect(x1, y1, x2, y2, x3, y3, x4, y4)
{
    let x = ((x1 * y2 - y1 * x2) * (x3 - x4) - (x1 - x2) * (x3 * y4 - y3 * x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));
    let y = ((x1 * y2 - y1 * x2) * (y3 - y4) - (y1 - y2) * (x3 * y4 - y3 * x4)) / ((x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4));

    return new Vector(x, y);
}