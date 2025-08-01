// import {console_toggle} from "../console";
import {GameEvent,GameEventKey,GameEventType} from "../event";
import {_defaultFont,font_get_line_height,font_get_text_dimension} from "../font";
import {gui_rect,UiWidgetState,UiWidgetCapability,widget_id,widget_context_of,gui_draw_text_editor,widget_context_set_text,widget_component_id,widget_activate, gui_init} from "../gui";
import {logic_set_controler,LogicControler} from "../logic";
import {cursor_set,draw_quad,draw_rect,draw_text_in_rect,MouseCursor,Rect,rect_center,rect_cut_left,rect_cut_right,rect_cut_top,rect_shrink,TextDrawOption,to_color,to_rect} from "../renderer";



////////////////////////////////////////////////////////////
// MARK: DOMAIN
////////////////////////////////////////////////////////////
interface Project
{
    name          : string;
    fileSystemRoot: FileSystemItem;
}





////////////////////////////////////////////////////////////
// MARK: TAB EDITOR
////////////////////////////////////////////////////////////
const enum TabType
{
    UNKNOWN = 0,
    TEXT    = 1,
    IMAGE   = 2,
}


////////////////////////////////////////////////////////////
function tab_type_from_name(s: string): TabType
{
    if (s.endsWith(".txt"))  return TabType.TEXT;
    if (s.endsWith(".md"))   return TabType.TEXT;
    if (s.endsWith(".json")) return TabType.TEXT;

    return TabType.UNKNOWN;
}


////////////////////////////////////////////////////////////
function tab_draw_text(rect: Rect, tab: FileSystemItem)
{
    if (tab.data === null) tab.data = "";
    let text = tab.data as string;

    let widgetId = widget_component_id(tab.id, 2);
    let widget   = gui_rect(widgetId, rect, 1, UiWidgetCapability.TEXT_CAPABILITY |
                                               UiWidgetCapability.TEXT_KEEP_STATE_AFTER_DE_ACTIVATION);

    if (widget.state & UiWidgetState.CREATED_THIS_FRAME)
    {
        let widgetContext = widget_context_of(widget);
        widget_context_set_text(widgetContext, text);
        widget.text = text;
        widgetContext.scale = 2;
    }

    gui_draw_text_editor(widget);
    if (_hasChangedTab) widget_activate(widget);
    _hasChangedTab = false;
}











////////////////////////////////////////////////////////////
// MARK: FILE SYSTEM
////////////////////////////////////////////////////////////
// The "file system" system is made to handle a small filetree.
// It will not work well with a large tree.
// We could do so by using a back buffer that is not a JS object

const enum FileSystemFlag
{
    FILE             = 0b000000_00001,
    DIRECTORY        = 0b000000_00010,
    EXPENDED         = 0b000000_00100,
    _DELETED_0       = 0b000000_01000,
    OPENED_IN_EDITOR = 0b000000_10000,
    DEPTH_MASK       = 0b111111_00000,

    EXPENDED_DIRECTORY = DIRECTORY | EXPENDED,
}

const DEPTH_MASK_OFFSET = 5;



interface FileSystemItem
{
    flag    : FileSystemFlag;
    name    : string;
    id      : number;
    frameId : number;
    children: FileSystemItem[];
    parent  : FileSystemItem | null;
    data    : any | null;
}


////////////////////////////////////////////////////////////
function file_tree_recursive_flatten(item: FileSystemItem, flatFileTree: FileSystemItem[], depth: number =0)
{
    for (let child of item.children)
    {
        child.flag    = (child.flag & ~FileSystemFlag.DEPTH_MASK) | (depth << DEPTH_MASK_OFFSET);
        child.frameId = widget_component_id(item.frameId, child.id);
        flatFileTree.push(child);
        if ((child.flag & FileSystemFlag.EXPENDED_DIRECTORY) === FileSystemFlag.EXPENDED_DIRECTORY)
            file_tree_recursive_flatten(child, flatFileTree, depth + 1);
    }
}












////////////////////////////////////////////////////////////
// MARK: CONTROLER
////////////////////////////////////////////////////////////
// let _projects: Project[] = [];
// let _selectedProject: string         = null as unknown as string;
let _fileSystemRoot : FileSystemItem   = null as unknown as FileSystemItem;
let _openedTabs     : FileSystemItem[] = [];
let _selectedTab    : FileSystemItem   = null as unknown as FileSystemItem;
let _hasChangedTab  : boolean          = false;
let _flattenFileTree: FileSystemItem[] = [];


const S = `Hello Bertrand
Comme tu peux le voir j'ai un chouette editeur.

D'aucun diraient que mon editeur ne fait pas grand chose...
Et pourtant tu peux naviguer au clavier.
Tu as ctrl+left/right qui marche.
Tu peux faire des selections dans tous les sens.
Tu peux copier et couper.
Copier c'est de la merde parce que c'est async en JS....

Franchement faut etre sacrement con pour mettre le copier en async.

Je me dis que les mecs qui ont fait cette feature ont ete tellement
pris pour des quart de dieux qu'ils ont tout de suite ete mis
sur la vrai partie du JS, webASM hi hi hi :)


Tu peux mettre des FAT blocs de text:
Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

Lorem ipsum dolor sit amet,
consectetur adipiscing elit,
sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
0
1
2`;




////////////////////////////////////////////////////////////
export function editor_launch()
{
    // ws_connect();

    let controler: LogicControler =
    {
        init  : init,
        deinit: deinit,

        process_event: process_event,
        simulate     : simulate,
        draw         : draw

    };

    logic_set_controler(controler);
}


////////////////////////////////////////////////////////////
function init()
{
    gui_init();

    if (_fileSystemRoot === null)
    {
        _fileSystemRoot =
        {
            flag    : FileSystemFlag.DIRECTORY,
            name    : "",
            id      : widget_id(__LINE__),
            frameId : 0,
            children: [],
            parent  : null,
            data    : null,
        };

        let d0: FileSystemItem =
        {
            flag    : FileSystemFlag.DIRECTORY,
            name    : "d0",
            id      : widget_id(__LINE__),
            frameId : 0,
            children: [],
            parent  : _fileSystemRoot,
            data    : null,
        };
        _fileSystemRoot.children.push(d0);


        let f0: FileSystemItem =
        {
            flag    : FileSystemFlag.FILE,
            name    : "f0.txt",
            id      : widget_id(__LINE__),
            frameId : 0,
            children: [],
            parent  : d0,
            data    : S
        };
        d0.children.push(f0);

        let f1: FileSystemItem =
        {
            flag    : FileSystemFlag.FILE,
            name    : "f1.txt",
            id      : widget_id(__LINE__),
            frameId : 0,
            children: [],
            parent  : d0,
            data    : null,
        };
        d0.children.push(f1);

        let f2: FileSystemItem =
        {
            flag    : FileSystemFlag.FILE,
            name    : "f2.txt",
            id      : widget_id(__LINE__),
            frameId : 0,
            children: [],
            parent  : d0,
            data    : null,
        };
        d0.children.push(f2);


        let d1: FileSystemItem =
        {
            flag    : FileSystemFlag.DIRECTORY,
            name    : "d1",
            id      : widget_id(__LINE__),
            frameId : 0,
            children: [],
            parent  : _fileSystemRoot,
            data    : null,
        };
        _fileSystemRoot.children.push(d1);
    }
}

////////////////////////////////////////////////////////////
function deinit()
{
}


////////////////////////////////////////////////////////////
function process_event(events: GameEvent[])
{
    for (let it of events)
    {
        // if (it.type === GameEventType.WEB_SOCKET)
        // {
        //     let wsData      = it.data;
        //     let messageId   = wsData.id;
        //     let messageData = wsData.data;

        //     if (messageId === RESPONSE_ID_LIST_PROJECTS)
        //     {
        //         // messageData is a list of project
        //         for (let it of messageData)
        //         {
        //             let name               = it.name;
        //             let alreadyKnowProject = false;

        //             for (let existingProject of _projects)
        //             {
        //                 if (name === existingProject.name)
        //                 {
        //                     alreadyKnowProject = true;
        //                     break;
        //                 }
        //             }

        //             if (alreadyKnowProject) continue;

        //             // @ts-ignore
        //             let newProject: Project = {};
        //             newProject.name = it.name;

        //             _projects.push(newProject);
        //         }
        //     }
        // }


        if (it.type === GameEventType.KEY)
        {
            if (it.key === GameEventKey.F5 && it.isPressed) location.reload();
            // if (it.key === GameEventKey.F1 && it.isPressed) console_toggle();
        }
    }
}


////////////////////////////////////////////////////////////
function simulate(elapsedTime: number, frameId: number)
{

}


////////////////////////////////////////////////////////////
function draw(windowRect: Rect, frameId: number)
{

    if (false)
    {
        let projectSelectionRect = to_rect(0, 0, Math.round(windowRect.width*0.5), Math.round(windowRect.height*0.6));
        projectSelectionRect = rect_center(windowRect, projectSelectionRect);

        draw_text_in_rect(projectSelectionRect, 2, "Select a project", 4);
        draw_rect(projectSelectionRect, 3, to_color(1, 0, 0, 1));
    }
    else
    {
        let [editionZone, rightPanel] = rect_cut_right(windowRect, 400);

        // render editor Zone
        {
            let tabBarFontScale  = 2;
            let tabBarTextHeight = font_get_line_height(_defaultFont, tabBarFontScale);
            let tabBarTextMargin = 5;
            let tabBarHeight = tabBarTextHeight + 2* tabBarTextMargin;
            let [tabRect, editorRect] = rect_cut_top(editionZone, tabBarHeight);

            draw_quad(to_rect(editorRect.x, editorRect.y-1, editorRect.width, 1), 10, to_color(1, 1, 1, 1));

            // TabBar
            {
                let x = tabRect.x;
                let y = tabRect.y;

                for (let i=0; i < _openedTabs.length ;i+=1)
                {
                    let tab                = _openedTabs[i];
                    let name               = tab.name;
                    let textDimensions     = font_get_text_dimension(name, _defaultFont, tabBarFontScale);
                    let closeIconDimension = textDimensions.height;
                    let tabWidth           = textDimensions.width + tabBarTextMargin + closeIconDimension + tabBarTextMargin;
                    if (tabWidth < 120) tabWidth = 120;

                    let thisTabRect        = to_rect(x, y, tabWidth, tabRect.height);
                    let tabId              = widget_component_id(tab.id, 0);
                    let tabWidget          = gui_rect(tabId, thisTabRect, 3, UiWidgetCapability.HOVERABLE | UiWidgetCapability.CLICKABLE);
                    let thisTabTextRect    = rect_shrink(thisTabRect, tabBarTextMargin);
                    let tabBackgroundColor = to_color(0, 0, 0, 1);
                    let tabBorderColor     = to_color(1, 1, 1, 1);
                    let tabtextColor       = to_color(1, 1, 1, 1);
                    if (tabWidget.state & UiWidgetState.HOVERED)
                    {
                        tabBackgroundColor = to_color(0.25, 0.25, 0.25, 1);
                    }

                    if (_selectedTab == tab)
                    {
                        tabBackgroundColor = to_color(1, 1, 1, 1);
                        tabtextColor       = to_color(0, 0, 0, 1);
                    }

                    if (tabWidget.state & UiWidgetState.CLICKED)
                    {
                        _selectedTab   = tab;
                        _hasChangedTab = true;
                    }

                    draw_quad(thisTabRect, 2, tabBackgroundColor);
                    draw_rect(thisTabRect, 4, tabBorderColor);
                    draw_text_in_rect(thisTabTextRect, 4, name, tabBarFontScale, TextDrawOption.LEFT, tabtextColor);

                    let closeIconOuterRect      = to_rect(x+tabWidth-tabBarTextMargin-closeIconDimension, y, closeIconDimension, tabRect.height);
                    let closeIcontextDimensions = font_get_text_dimension("x", _defaultFont, tabBarFontScale);

                    let closeIconRect     = rect_center(closeIconOuterRect, closeIcontextDimensions);
                    let closeButtonId     = widget_component_id(tab.id, 1);
                    let closeButtonWidget = gui_rect(closeButtonId, closeIconRect, 4, UiWidgetCapability.HOVERABLE | UiWidgetCapability.CLICKABLE);
                    let closeButtonBackgroundColor = tabBackgroundColor;
                    if (closeButtonWidget.state & UiWidgetState.HOVERED)
                        closeButtonBackgroundColor = to_color(0.5, 0.5, 0.5, 1);
                    draw_quad(closeIconRect, 4, closeButtonBackgroundColor);
                    draw_text_in_rect(closeIconRect, 4, "x", tabBarFontScale, TextDrawOption.CENTER, tabtextColor);

                    if (closeButtonWidget.state & UiWidgetState.CLICKED)
                    {
                        if (_selectedTab == tab)
                        {
                            // @Incomplete:
                            //     Open another tab
                            _selectedTab = null as unknown as FileSystemItem;
                        }

                        tab.flag &= ~FileSystemFlag.OPENED_IN_EDITOR;

                        _openedTabs.splice(i, 1);
                        i-= 1;
                        x -= tabWidth;
                    }

                    x += tabWidth;
                }
            }


            // Render data of file for edition
            if (_selectedTab !== null)
            {
                if (tab_type_from_name(_selectedTab.name)) tab_draw_text(editorRect, _selectedTab);
            }
        }


        // Render the right menu
        {
            let RIGHT_PANEL_BACKGROUND_COLOR = to_color(.4, .4, .4, 1);
            draw_quad(rightPanel, 1, RIGHT_PANEL_BACKGROUND_COLOR);

            let iconWidth  = 20;
            let iconMargin = 5;
            let iconBarHeight = iconWidth +2*iconMargin;
            let [iconBarRect, fileTreeRect] = rect_cut_top(rightPanel, iconBarHeight);

            // Render top icon bar
            {
                let iconRect: Rect = null as unknown as Rect;

                {
                    [iconRect, iconBarRect] = rect_cut_left(iconBarRect, iconBarHeight, 2);
                    let widgetId = widget_id(__LINE__);
                    let widget   = gui_rect(widgetId, iconRect, 4, UiWidgetCapability.HOVERABLE | UiWidgetCapability.CLICKABLE);
                    draw_rect(iconRect, 4, to_color(1, 1 ,1, 1));
                }

                {
                    [iconRect, iconBarRect] = rect_cut_left(iconBarRect, iconBarHeight, 2);
                    let widgetId = widget_id(__LINE__)
                    draw_rect(iconRect, 4, to_color(1, 1 ,1, 1));
                }
            }

            // Render file tree
            {
                let scale      = 3;
                let itemMargin = 1;
                let lineHeight = 10*scale + 2*itemMargin;
                let rect       = to_rect(fileTreeRect.x, fileTreeRect.y, fileTreeRect.width, lineHeight);

                _flattenFileTree.length = 0;
                file_tree_recursive_flatten(_fileSystemRoot, _flattenFileTree);

                for (let i=0; i < _flattenFileTree.length ;i+=1)
                {
                    let item   = _flattenFileTree[i];
                    let widget = gui_rect(item.frameId, rect, 2, UiWidgetCapability.HOVERABLE | UiWidgetCapability.CLICKABLE)

                    // This need to be saved before we update the flag
                    // to prevent having next frame flag interferring with
                    // this frame flat file system hierarchy
                    let isExpended = (item.flag & FileSystemFlag.DIRECTORY);
                    let depth      = (item.flag & FileSystemFlag.DEPTH_MASK) >> DEPTH_MASK_OFFSET;

                    let backgroundColor = RIGHT_PANEL_BACKGROUND_COLOR;
                    if (widget.state & UiWidgetState.HOVERED)
                    {
                        cursor_set(MouseCursor.POINTER);
                        backgroundColor = to_color(.5, .5, .5, 1);
                    }

                    if (_selectedTab === item)
                        backgroundColor = to_color(0, 0, .5, 1);

                    draw_quad(rect, 2, backgroundColor);


                    if (widget.state & UiWidgetState.CLICKED)
                    {
                        if (item.flag & FileSystemFlag.DIRECTORY)
                            item.flag ^= FileSystemFlag.EXPENDED;

                        if (item.flag & FileSystemFlag.FILE)
                        {
                            if ((item.flag & FileSystemFlag.OPENED_IN_EDITOR) === 0)
                            {
                                item.flag |= FileSystemFlag.OPENED_IN_EDITOR;
                                _openedTabs.push(item);
                                _hasChangedTab = true;
                            }

                            _selectedTab = item;
                        }
                    }

                    rect.x += depth * 20;
                    draw_text_in_rect(rect, 2, item.name, scale, TextDrawOption.LEFT);
                    rect.x -= depth * 20;
                    rect.y += lineHeight;
                }
            }
        }
    }
}