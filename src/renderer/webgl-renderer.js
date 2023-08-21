import {Shader} from "../Shader.js";
import {Renderer} from "../Renderer.js";
import {Camera} from "../Camera.js";
import {initVAO, initTexture, initCubeVAO} from "../init-buffers.js";

import {mat4, vec3} from "gl-matrix";

import vsSource from './shaders/mat1/v.vert?raw';
import fsSource from './shaders/mat1/f.frag?raw';

import skyVsSource from './shaders/skybox_grad/skybox_grad.vert?raw';
import skyFsSource from './shaders/skybox_grad/skybox_grad.frag?raw';

import updateVsSource from './shaders/update_particle/update_particle.vert?raw';
import updateFsSource from './shaders/update_particle/update_particle.frag?raw';

import drawVsSource from './shaders/draw_particle/draw_particle.vert?raw';
import drawFsSource from './shaders/draw_particle/draw_particle.frag?raw';

import quadVsSource from './shaders/NDCQuad/NDCQuad.vert?raw';
import quadFsSource from './shaders/NDCQuad/NDCQuad.frag?raw';

class WebGLRenderer extends Renderer {

    //---------------------------------------
    constructor(){
        // make canvas / define callbacks.
        super();

        // set up gl
        this.gl = this.canvas.getContext("webgl2");
          
        this.width = this.canvas.width;
        this.height = this.canvas.height;

        // default material shader
        this.shader = new Shader(this.gl, vsSource, fsSource);
        // background shader
        this.skyShader = new Shader(this.gl, skyVsSource, skyFsSource);
        // screen NDC quad shader
        this.quadShader = new Shader(this.gl, quadVsSource, quadFsSource);
        // shader for update position
        this.updateShader = new Shader(this.gl, updateVsSource, updateFsSource);
        this.updateShader.use();
        this.updateShader.setInt("positionTexRead", 0);
        this.updateShader.setInt("velocitiesTex", 1);
        // shader to draw instanced cube.
        this.drawShader = new Shader(this.gl, drawVsSource, drawFsSource);

        // setup datas
        this.vao = initVAO(this.gl);
        this.texture = initTexture(this.gl, {
            checker_gray : "src\\images\\checker2k.png",
            checker_colored : "src\\images\\checker2kC.png"
        });
        
        // setup camera
        this.camera = new Camera(8, 6, 10, 0, 1, 0, 0, 0, 45);
        this.camera = new Camera(10, 10, 20, 0, 1, 0, 0, 0, 45);
        this.camera.lookAt(0, 0, 0);

        // extensions
        const ext = this.gl.getExtension('EXT_color_buffer_float');
    }

    //---------------------------------------
    // helper functions 
    createTexture(gl, data, width, height) {
        const result = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, result);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, width, height, 0, gl.RGBA, gl.FLOAT, data);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D, null);
        return result;
    }

    createFramebuffer(gl, tex){
        const result = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, result);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        return result;
    }

    //---------------------------------------
    init(){
        let gl = this.gl;
        
        // define nr of particle, and its texture
        this.particleTexWidth = 600;
        this.particleTexHeight = 600;
        this.numParticle = this.particleTexWidth * this.particleTexHeight;


        const ids = new Array(this.numParticle).fill(0).map((_,i)=>i);
        this.idBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.idBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(ids), gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
                
        let xAbsMax = 5;
        let yAbsMax = 5;
        let zAbsMax = 5;

        const rand = (a,b) => (a + Math.random()*(b-a));

        const positions = new Float32Array(ids.map(_ => [rand(-xAbsMax, xAbsMax), rand(-yAbsMax, yAbsMax), rand(-zAbsMax, zAbsMax), 1]).flat());
        const velocities = new Float32Array(ids.map(_ => [rand(-1, 1), rand(-1, 1), rand(-1, 1), 1]).flat());
        
        this.positionTex1 = this.createTexture(gl, positions, this.particleTexWidth, this.particleTexHeight);
        this.positionTex2 = this.createTexture(gl, null, this.particleTexWidth, this.particleTexHeight);
        this.velocityTex = this.createTexture(gl, velocities, this.particleTexWidth, this.particleTexHeight);

        this.positionsFb1 = this.createFramebuffer(gl, this.positionTex1);
        this.positionsFb2 = this.createFramebuffer(gl, this.positionTex2);

        this.positionInfoRead = {fb:this.positionsFb1, tex:this.positionTex1};
        this.positionInfoWrite = {fb:this.positionsFb2, tex:this.positionTex2};

        // setup instanced rendering.
        this.instancedCubeVAO = initCubeVAO(gl);
        gl.bindVertexArray(this.instancedCubeVAO);
            gl.bindBuffer(gl.ARRAY_BUFFER, this.idBuffer);
            gl.enableVertexAttribArray(3);
            gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 0, 0);
            gl.vertexAttribDivisor(3, 1);
        gl.bindVertexArray(null);

    }

    //---------------------------------------
    OnResize(width, height){
        this.width = width;
        this.height = height;
    }

    //---------------------------------------
    beforeFrame(){
        let gl = this.gl;

        // Update positions
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.positionInfoWrite.fb);
        gl.viewport(0, 0, this.particleTexWidth, this.particleTexHeight);
        this.updateShader.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.positionInfoRead.tex);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTex);
        this.updateShader.setVec2("texDimensions", this.particleTexWidth, this.particleTexHeight);
        this.updateShader.setFloat("deltaTime", this.timeDelta/1000.0);
        this.renderQuad();

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        let swap = this.positionInfoRead;
        this.positionInfoRead = this.positionInfoWrite;
        this.positionInfoWrite = swap;
    }

    // Main loop function.
    OnFrame(timestamp, timeDelta){

        super.OnFrame();

        let gl = this.gl;
        gl.clearColor(0.0, 0.0, 0.0, 1.0);
        gl.clearDepth(1.0);
        gl.enable(gl.DEPTH_TEST);
        gl.depthFunc(gl.LEQUAL);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        const view = this.camera.getViewMatrix();
        const proj = mat4.create();
        mat4.perspective(proj, this.camera.fov * Math.PI / 180.0, this.width/this.height, 0.1, 100.0);

        this.shader.use();
        this.shader.setMat4("proj", proj);
        this.shader.setMat4("view", view);

        this.drawShader.use();
        this.drawShader.setMat4("proj", proj);
        this.drawShader.setMat4("view", view);

        this.skyShader.use();
        this.skyShader.setMat4("proj", proj);
        let viewTrans = mat4.fromValues(
            view[0], view[1], view[2], 0,
            view[4], view[5], view[6], 0,
            view[8], view[9], view[10], 0,
            0, 0, 0, 1
        );
        this.skyShader.setMat4("view", viewTrans);

        // render scene
        gl.viewport(0, 0, this.width, this.height);
        gl.depthMask(true);
        this.drawParticles();
        this.drawScene(this.shader);

        // debug texture
        let debugSize = this.width * 0.1;
        gl.viewport(0, 0, debugSize, debugSize);
        this.quadShader.use();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.positionTex1);
        this.renderQuad();

        gl.viewport(debugSize, 0, debugSize, debugSize);
        gl.bindTexture(gl.TEXTURE_2D, this.positionTex2);
        this.renderQuad();

        gl.viewport(debugSize*2, 0, debugSize, debugSize);
        gl.bindTexture(gl.TEXTURE_2D, this.velocityTex);
        this.renderQuad();

        //render background
        gl.viewport(0, 0, this.width, this.height);
        gl.depthMask(false);
        this.skyShader.use();
        this.renderCube();
    }

    drawParticles(){
        let gl = this.gl;
        let model = mat4.create();


        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.positionInfoRead.tex);
        this.drawShader.use();
        this.drawShader.setInt("positionTex", 0);
        this.drawShader.setVec2("texDimentions", this.particleTexWidth, this.particleTexHeight);
        mat4.scale(model, model, vec3.fromValues(0.01, 0.01, 0.01));
        this.drawShader.setMat4("model", model);
        
        gl.bindVertexArray(this.instancedCubeVAO);
        gl.drawArraysInstanced(gl.TRIANGLES, 0, 36, this.numParticle);
        
    }

    // draw geometries with given shader
    drawScene(shader){
        let gl = this.gl;
        let model = mat4.create();

        this.shader.use();
        model = mat4.create();
        mat4.translate(model, model, vec3.fromValues(0, -1.0, 0));
        mat4.scale(model, model, vec3.fromValues(5, 5, 5));
        shader.setMat4("model", model);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.texture.checker_gray);
        this.renderPlane();
    }

    renderCube(){
        let gl = this.gl;
        gl.bindVertexArray(this.vao.cube);
        gl.drawArrays(gl.TRIANGLES, 0, 36);
    }

    renderPlane(){
        let gl = this.gl;
        gl.bindVertexArray(this.vao.plane);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    renderQuad(){
        let gl = this.gl;
        gl.bindVertexArray(this.vao.quad);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    

}

export {WebGLRenderer}