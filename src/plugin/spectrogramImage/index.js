export default class SpectrogramImagePlugin {
    /**
     * @param  {SpectrogramPluginParams} params parameters use to initialise the plugin
     * @return {PluginDefinition} an object representing the plugin
     */
    static create(params) {
        return {
            name: 'spectrogramImage',
            params: params,
            instance: SpectrogramImagePlugin
        };
    }
    constructor(params, ws) {
        this.params = params;
        this.wavesurfer = ws;
        this.util = ws.util;
        this.imageUrl = params.imageUrl;
        this.style = this.util.style;
        this.height = params.height;
        // 数据交互相关变量
        this.start = 0;
        this.end = 0;
        this.currentStart = 0;
        this.currentEnd = 0;
        this.regions = {
            flag: false,
            x: 0
        };
        this.moveRegion = {
            drag: false,
            resize: false,
            x: 0
        };
        this.handleResize = {
            handleLeft: 0,
            handleLeftWidth: 0,
            target: null,
            flag: false,
            x: 0
        };
        this.moveRegionPosition = {
            regionLeftHalfTime: 0,
            regionRightHalfTime: 0,
            startTime: 0
        };
        this.tempArea = [];
        this.regionMinWidth = 5;
        this.regionList = [];
        this.waveCreateRegion = false;
        // end 数据交互相关变量

        this._onReady = () => {
            const drawer = (this.drawer = ws.drawer);
            this.width = drawer.width;
            this.container =
                'string' == typeof params.container
                    ? document.querySelector(params.container)
                    : params.container;

            if (!this.container) {
                throw Error('No container for WaveSurfer spectrogram');
            }

            this.container.style.position = '';
            this.style(this.container, {
                position: 'relative',
                overflowY: 'hidden',
                textAlign: 'left',
                height: `${this.height}px`,
                margin: '0 auto',
                width: `${this.width}px`,
                userSelect: 'none'
            });
            let imgElement = document.createElement('img');
            imgElement.src = this.imageUrl;
            imgElement.style.userSelect = 'none';

            this.regionsLayer = document.createElement('div');
            this.regionsLayer.id = 'regions-layer';
            this.style(this.regionsLayer, {
                height: this.height + 'px',
                width: this.width + 'px',
                userSelect: 'none',
                position: 'absolute',
                left: 0,
                top: 0
            });

            const eventDown = e => {
                if (e.target.nodeName === 'DIV') {
                    this.regions.x = e.offsetX;
                    this.regions.flag = true;
                    this.currentStart = this.drawer.handleEvent(e, true);
                }

                // 选中需要移动的元素
                if (e.target.nodeName === 'REGIONS') {
                    this.moveRegion.drag = true;
                    this.moveRegion.x = e.offsetX;
                    const duration = this.wavesurfer.getDuration();
                    this.moveRegionPosition.startTime = this.wavesurfer.regions.util.getRegionSnapToGridValue(
                        this.drawer.handleEvent(e, true) * duration
                    ); // Store the selected point of contact when we begin dragging

                    this.moveRegionPosition.regionLeftHalfTime =
                        this.moveRegionPosition.startTime - this.start;
                    // Store for scroll calculations
                    this.moveRegionPosition.regionRightHalfTime =
                        this.end - this.moveRegionPosition.startTime;
                }
            };
            const eventUp = e => {
                // 将频谱街区信同步到波形选区信息
                if (this.tempArea.length === 1) {
                    // 检查选区最小宽度
                    if (
                        this.getNumber(this.tempArea[0].style.width) <
                        this.regionMinWidth
                    ) {
                        // 小于最小宽度，移除元素
                        this.regionsLayer.removeChild(this.tempArea[0]);
                        this.tempArea = [];
                        this.onResetMouseStatus();
                        return;
                    }
                    let currentRegion = null;
                    if (e.target.nodeName === 'HANDLE') {
                        currentRegion = e.target.parentNode;
                    } else {
                        currentRegion =
                            e.target.children[e.target.children.length - 1];
                    }
                    const id = new Date().getTime();
                    currentRegion.dataset.regionId = id;
                    const region = {
                        id,
                        start: this.start,
                        end: this.end,
                        drag: true,
                        resize: true,
                        element: currentRegion
                    };
                    this.wavesurfer.addRegion(region);
                    this.regionList.push(region);
                    this.tempArea = [];
                }
                this.tempArea = [];
                this.onResetMouseStatus();
            };

            const eventMove = e => {
                this.onResize(e);
                this.onMove(e);
                this.onAddRegion(e);
            };
            this.regionsLayer.addEventListener('mousedown', eventDown);
            this.regionsLayer.addEventListener('mouseup', eventUp);
            this.regionsLayer.addEventListener('mousemove', eventMove);
            this.regionsLayer.addEventListener('mouseleave', () => {
                this.onResetMouseStatus();
            });
            this.container.appendChild(imgElement);
            this.container.appendChild(this.regionsLayer);
        };

        this.wavesurfer.on('region-created', () => {
            this.waveCreateRegion = true;
        });
        this.wavesurfer.on('region-update-end', (e) => {
            if (this.waveCreateRegion) {
                this.waveCreateRegion = false;
                // 波形选区创建完成后，需要延迟一下才能正常获取参数
                this.regions.flag = true;
                this.regions.x = e.element.offsetLeft;
                this.regions.width = e.element.offsetWidth;
                this.onAddRegion(e, (region) => {
                    this.regionList.push({
                        id: e.id,
                        start: e.start,
                        end: e.end,
                        element: region
                    });
                    region.dataset.regionId = e.id;
                    this.tempArea = [];
                });
                this.onResetMouseStatus();
            }

            // 更新波形选区位置和大小,同步频谱选区位置和大小
            if (this.moveRegion.drag) { return; }
            const waveRegion = this.wavesurfer.regions.list[e.element.dataset.id];
            const imageRegion = this.regionList.find(
                (item) => String(item.id) === String(e.element.dataset.id),
            );
            if (imageRegion !== undefined) {
                imageRegion.element.style.left = e.element.style.left;
                imageRegion.element.style.width = e.element.style.width;
                imageRegion.start = waveRegion.start;
                imageRegion.end = waveRegion.end;
            }
        });
    }

    init() {
        // Check if ws is ready
        if (this.wavesurfer.isReady) {
            this._onReady();
            console.log('频谱图插件初始化完成!');
        }

        this.wavesurfer.on('ready', this._onReady);
    }

    /**
     * 释放鼠标所有状态（添加区域状态、移动区域状态、调整区域大小状态）
     */
    onResetMouseStatus = () => {
        this.regions.flag = false;
        this.moveRegion.drag = false;
        this.moveRegion.resize = false;
        this.handleResize.flag = false;
        this.regions.width = null;
        this.waveCreateRegion = false;
    };

    /**
     * 调整区域大小
     * @param { MouseEvent } e 鼠标事件
     */
    onResize(e) {
        const { flag } = this.handleResize;
        if (flag === 'handleRight' || flag === 'handleLeft') {
            let width = `${e.offsetX -
                this.getNumber(this.handleResize.target.style.left)}px`;
            if (e.target.nodeName === 'DIV') {
                if (flag === 'handleLeft') {
                    this.handleResize.target.style.left = `${e.offsetX}px`;
                    width = `${this.getNumber(
                        this.handleResize.handleLeftWidth
                    ) +
                        this.getNumber(this.handleResize.handleLeft) -
                        e.offsetX}px`;
                }
                this.handleResize.target.style.width = width;
            } else if (e.target.nodeName === 'REGIONS') {
                this.handleResize.target.style.width = `${Math.abs(
                    e.offsetX
                )}px`;
            }
            this.onRegionMove(e);
        }
    }
    /**
     * 移动选择区域
     * @param {Event} e event
     */
    onMove(e) {
        if (e.target.nodeName === 'REGIONS' && this.moveRegion.drag) {
            e.target.style.left = `${this.getNumber(e.target.style.left) +
                e.offsetX -
                this.moveRegion.x}px`;
            this.onRegionMove(e);

            // 同步波形位置和title
            this.wavesurfer.regions.list[
                e.target.dataset.regionId
            ].element.style.left = `${this.getNumber(e.target.style.left) +
            e.offsetX -
            this.moveRegion.x}px`;
            this.wavesurfer.regions.list[
                e.target.dataset.regionId
            ].element.title = e.target.title;
        }
    }
    /**
     * 正在移动选区
     * @param {Event} e event
     */
    onRegionMove(e) {
        const duration = this.wavesurfer.getDuration();
        let time = this.wavesurfer.regions.util.getRegionSnapToGridValue(
            this.drawer.handleEvent(e) * duration
        );
        if (this.moveRegion.drag) {
            const maxEnd = this.wavesurfer.getDuration();

            if (time > maxEnd - this.moveRegionPosition.regionRightHalfTime) {
                time = maxEnd - this.moveRegionPosition.regionRightHalfTime;
            }

            if (time - this.moveRegionPosition.regionLeftHalfTime < 0) {
                time = this.moveRegionPosition.regionLeftHalfTime;
            }
        }
        if (this.moveRegion.resize) {
            // To maintain relative cursor start point while resizing
            // we have to handle for minLength
            let { minLength } = this.wavesurfer;
            if (!minLength) {
                minLength = 0;
            }

            if (this.moveRegion.resize === 'start') {
                if (time > this.end - minLength) {
                    time = this.end - minLength;
                }

                if (time < 0) {
                    time = 0;
                }
            } else if (this.moveRegion.resize === 'end') {
                if (time < this.start + minLength) {
                    time = this.start + minLength;
                }

                if (time > duration) {
                    time = duration;
                }
            }
        }

        const delta = time - this.moveRegionPosition.startTime;
        this.moveRegionPosition.startTime = time;
        if (this.moveRegion.drag) {
            this.onRegionDrag(delta, e.target);
        }
        if (this.moveRegion.resize) {
            this.onRegionResize(delta, this.moveRegion.resize);
        }
    }
    /**
     * 拖动选区计算位置
     * @param { Number } delta delta
     * @param { HtmlElement } target target
     */
    onRegionDrag(delta, target) {
        const maxEnd = this.wavesurfer.getDuration();
        if (this.end + delta > maxEnd) {
            delta = maxEnd - this.end;
        }
        if (this.start + delta < 0) {
            delta = this.start * -1;
        }
        this.start += delta;
        this.end += delta;
        target.title = this.formatTime(this.start, this.end);

        const region = this.regionList.find(
            item => String(item.id) === String(target.dataset.regionId)
        );
        region.start = this.start;
        region.end = this.end;

        this.wavesurfer.regions.list[
            target.dataset.regionId
        ].start = this.start;
        this.wavesurfer.regions.list[target.dataset.regionId].end = this.end;
    }
    /**
     * 调整选区大小计算位置
     * @param { Number } delta delta
     * @param { String } direction handle start or end
     */
    onRegionResize(delta, direction) {
        const duration = this.wavesurfer.getDuration();
        let { minLength } = this.wavesurfer;
        if (!minLength) {
            minLength = 0;
        }
        if (direction === 'start') {
            if (delta > 0 && this.end - (this.start + delta) < minLength) {
                delta = this.end - minLength - this.start;
            }
            if (delta < 0 && this.start + delta < 0) {
                delta = this.start * -1;
            }
            this.start = Math.min(this.start + delta, this.end);
            this.end = Math.max(this.start + delta, this.end);
        } else {
            if (delta < 0 && this.end + delta - this.start < minLength) {
                delta = this.start + minLength - this.end;
            }

            if (delta > 0 && this.end + delta > duration) {
                delta = duration - this.end;
            }
            this.start = Math.min(this.end + delta, this.start);
            this.end = Math.max(this.end + delta, this.start);
        }

        const region = this.regionList.find(
            item =>
                String(item.id) ===
                String(this.handleResize.target.dataset.regionId)
        );
        region.start = this.start;
        region.end = this.end;
        this.handleResize.target.title = this.formatTime(this.start, this.end);
        const { regionId } = this.handleResize.target.dataset;
        const wavesurferRegionEle = this.wavesurfer.regions.list[regionId];
        wavesurferRegionEle.start = this.start;
        wavesurferRegionEle.end = this.end;
        wavesurferRegionEle.element.style.left = this.handleResize.target.style.left;
        wavesurferRegionEle.element.style.width = this.handleResize.target.style.width;
        wavesurferRegionEle.element.title = this.formatTime(
            this.start,
            this.end
        );
    }
    /**
     * 添加新区域
     * @param {Event} e event
     * @param {Function} callback callback
     */
    onAddRegion(e, callback) {
        if (!this.regions.flag) { return; }
        if (this.tempArea.length === 0) {
            // 创建区域元素
            const regionsEle = document.createElement('regions');
            this.tempArea.push(regionsEle);
            this.style(regionsEle, {
                left: `${this.regions.x}px`,
                top: 0,
                height: this.height + 'px',
                position: 'absolute',
                backgroundColor: 'rgba(255, 255, 255, 0.5)',
                cursor: 'move'
            });
            if (this.regions.width) {
                regionsEle.style.width = `${this.regions.width}px`;
            }
            regionsEle.className = 'regions';
            // 创建区域块右侧线条
            const handleStart = document.createElement('handle');
            handleStart.className = 'handle-start';
            this.style(handleStart, {
                position: 'absolute',
                height: '100%',
                cursor: 'col-resize',
                borderLeft: '2px solid #fff',
                left: 0
            });
            handleStart.addEventListener('mousedown', event => {
                const duration = this.wavesurfer.getDuration();
                this.moveRegionPosition.startTime = this.wavesurfer.regions.util.getRegionSnapToGridValue(
                    this.drawer.handleEvent(event, true) * duration
                ); // Store the selected point of contact when we begin dragging
                this.moveRegion.resize = 'start';
                this.handleResize.flag = 'handleLeft';
                this.handleResize.target = event.target.parentNode;
                this.handleResize.handleLeft =
                    event.target.parentNode.style.left;
                this.handleResize.handleLeftWidth =
                    event.target.parentNode.style.width;
            });

            // 创建区域块左侧线条
            const handleEnd = document.createElement('handle');
            handleEnd.className = 'handle-end';
            this.style(handleEnd, {
                position: 'absolute',
                height: '100%',
                cursor: 'col-resize',
                borderLeft: '2px solid #fff',
                right: 0
            });
            handleEnd.addEventListener('mousedown', event => {
                const duration = this.wavesurfer.getDuration();
                this.moveRegionPosition.startTime = this.wavesurfer.regions.util.getRegionSnapToGridValue(
                    this.drawer.handleEvent(event, true) * duration
                ); // Store the selected point of contact when we begin dragging
                this.moveRegion.resize = 'end';
                this.handleResize.flag = 'handleRight';
                this.handleResize.target = event.target.parentNode;
            });
            handleEnd.addEventListener('mouseup', () => {
                this.onResetMouseStatus();
            });
            regionsEle.appendChild(handleStart);
            regionsEle.appendChild(handleEnd);
            this.regionsLayer.appendChild(regionsEle);
            if (callback) {
                callback(regionsEle);
            }
        } else {
            const regionsEle = this.tempArea[0];
            if (e.target.nodeName === 'REGIONS') {
                regionsEle.style.width = `${e.offsetX}px`;
            } else {
                regionsEle.style.width = `${e.offsetX -
                    this.getNumber(regionsEle.style.left)}px`;
            }
            this.onGetPosition(e);
        }
    }
    /**
     *  获取start、end位置
     * @param {Event} e event
     */
    onGetPosition(e) {
        this.currentEnd = this.drawer.handleEvent(e);
        const duration = this.wavesurfer.getDuration();
        const { util } = this.wavesurfer.regions;
        const startUpdate = util.getRegionSnapToGridValue(
            this.currentStart * duration
        );
        const endUpdate = util.getRegionSnapToGridValue(
            this.currentEnd * duration
        );
        const start = Math.min(endUpdate, startUpdate);
        const end = Math.max(endUpdate, startUpdate);
        const title = this.formatTime(start, end);
        this.start = start;
        this.end = end;
        e.target.parentNode.title = title;
    }
    updateRender(ele) {
        // duration varies during loading process, so don't overwrite important data
        const dur = this.wavesurfer.getDuration();
        const width = this.imageWidth;
        let startLimited = ele.start;
        let endLimited = ele.end;

        if (startLimited < 0) {
            startLimited = 0;
            endLimited -= startLimited;
        }

        if (endLimited > dur) {
            endLimited = dur;
            startLimited = dur - (endLimited - startLimited);
        }

        if (this.wavesurfer.minLength != null) {
            endLimited = Math.max(
                startLimited + this.wavesurfer.minLength,
                endLimited
            );
        }

        if (this.wavesurfer.maxLength != null) {
            endLimited = Math.min(
                startLimited + this.wavesurfer.maxLength,
                endLimited
            );
        }

        if (ele.element != null) {
            // Calculate the left and width values of the region such that
            // no gaps appear between regions.
            const left = Math.round((startLimited / dur) * width);
            const regionWidth = Math.round((endLimited / dur) * width) - left;
            this.style(ele.element, {
                left: `${left}px`,
                width: `${regionWidth}px`
            });
        }
    }
    /**
     * 移除px单位,返回数值用来计算
     * @param { String } str str
     * @returns  Number
     */
    getNumber(str) {
        return Number(str.replace('px', ''));
    }
    formatTime(start, end) {
        // eslint-disable-next-line eqeqeq
        // eslint-disable-next-line max-len
        return (start === end ? [start] : [start, end])
            .map(
                // eslint-disable-next-line no-mixed-operators
                time =>
                    [
                        Math.floor((time % 3600) / 60), // minutes
                        `00${Math.floor(time % 60)}`.slice(-2) // seconds
                    ].join(':')
            )
            .join('-');
    }
}
