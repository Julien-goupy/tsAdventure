import { Color, draw_sprite, Rect, rect_copy, renderer_set_texture, Texture, texture_load, TextureInterpolation, to_color, to_rect } from "./renderer";

export let _defaultFont: MonoFont = null as unknown as MonoFont;

export interface MonoFont
{
    name: string;
    texture: Texture;
    glyphs: Map<number, Rect>;

    width: number;
    height: number;

    ascender: number;
    defaultCharIndex: number;
}


////////////////////////////////////////////////////////////
export function font_load(name: string): MonoFont
{
    let font: MonoFont =
    {
        name: name,
        texture: null as unknown as Texture,
        glyphs: new Map(),
        width: 0,
        height: 0,
        ascender: 0,
        defaultCharIndex: 0
    };

    async function _do_the_load(font: MonoFont)
    {
        let fontDataUrl = `/ressource/font/${font.name}.json`;
        let fontDataResponse = await fetch(fontDataUrl);
        if (fontDataResponse.ok === false)
        {
            console.error(`Cannot load font data [${fontDataUrl}]`);
        }
        else
        {
            let fontData = await fontDataResponse.json();
            font.width = fontData.width;
            font.height = fontData.height;
            font.ascender = fontData.ascender;

            let fontTextureName = fontData.textureName;
            font.texture = texture_load(`/ressource/font/${fontTextureName}`, TextureInterpolation.NEAREST);

            let glyphs = fontData.glyphs;
            for (let glyphData of glyphs)
            {
                let x = glyphData.x * font.width;
                let y = glyphData.y * font.height;
                let width = glyphData.w * font.width;
                let height = glyphData.h * font.height;

                font.glyphs.set(glyphData.utf32, to_rect(x, y, width, height));
            }
        }
    }

    _do_the_load(font);
    return font;
}



////////////////////////////////////////////////////////////
export async function font_init(): Promise<boolean>
{
    let hasFontBeenCorrectlyInit = true;
    _defaultFont = font_load("minogram");
    return hasFontBeenCorrectlyInit;
}


////////////////////////////////////////////////////////////
export function font_get_line_height(font: MonoFont, scale: number): number
{
    return Math.floor(font.height * scale);
}



////////////////////////////////////////////////////////////
export function font_get_text_dimension(s: string, font: MonoFont, scale: number): Rect
{
    return to_rect(0, 0, Math.floor(s.length * font.width * scale), Math.floor(font.height * scale));
}


////////////////////////////////////////////////////////////
export function font_draw_ascii(x: number, y: number, z: number, font: MonoFont, scale: number, utf32: number, color: Color = to_color(1, 1, 1, 1))
{
    if (utf32 === 32)          return;
    if (font.texture === null) return;

    let r: Rect = to_rect(x, y, Math.floor(font.width * scale), Math.floor(font.height * scale));

    let tempUv: Rect | undefined = font.glyphs.get(utf32);
    if (tempUv === undefined) tempUv = font.glyphs.get(font.defaultCharIndex) as Rect;

    draw_sprite(r, z, font.texture, tempUv, color);
}