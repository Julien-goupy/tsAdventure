import { event_get_frame_event, GameEvent } from "./event";
import { gui_init_frame, gui_prepare_new_frame } from "./gui";
import { Rect, renderer_get_window_info, renderer_immediate_flush, renderer_start_frame } from "./renderer";


////////////////////////////////////////////////////////////
// MARK: LOGIC CONTROLER
////////////////////////////////////////////////////////////
export interface LogicControler {
    init: () => void;
    deinit: () => void;

    process_event: (events: GameEvent[]) => void;
    simulate: (elapsedTime: number, frameId: number) => void;
    draw: (windowRect: Rect, frameId: number) => void;
}


let _currentControler = null as unknown as LogicControler;
let _now = 0;
let _lastFrameTime = 0;
let _frameId = 0;


////////////////////////////////////////////////////////////
export function logic_set_controler(newControler: LogicControler) {
    if (_currentControler !== null) _currentControler.deinit();
    _currentControler = newControler;
    _currentControler.init();
    _now = performance.now();
}


////////////////////////////////////////////////////////////
export function game_render_one_frame() {
    let startOfFrame = performance.now() / 1000.0;

    let [windowRect, windowWidthInPixel, windowHeightInPixel] = renderer_get_window_info();
    renderer_start_frame();
    let events = event_get_frame_event();
    gui_init_frame();

    _lastFrameTime = _now;
    _now = performance.now() / 1000.0;
    let elapsedTime = _now - _lastFrameTime;

    _currentControler.process_event(events);

    gui_prepare_new_frame();

    _currentControler.simulate(elapsedTime, _frameId);
    _currentControler.draw(windowRect, _frameId);

    renderer_immediate_flush();
    _frameId += 1;

    let endOfFrame = performance.now() / 1000.0;
    // console.log("Frame duration", endOfFrame - startOfFrame);

    requestAnimationFrame(game_render_one_frame);
}