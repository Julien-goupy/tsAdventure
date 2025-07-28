////////////////////////////////////////////////////////////
export function char_is_space(s: string, i: number): boolean
{
    let c = s.charCodeAt(i);
    return (c === 32 ||  // " "
            c ===  9 ||  // "\t"
            c === 10 ||  // "\n"
            c === 11 ||  // "\v"
            c === 12 ||  // "\f"
            c === 13  ); // "\r"
    // Omit unicode spaces.....
}


////////////////////////////////////////////////////////////
export function char_is_alphanum(s: string, i: number): boolean
{
    let c = s.charCodeAt(i);
    return (65 <= c && c <=  90) ||
           (48 <= c && c <=  57) ||
           (97 <= c && c <= 122)  ;
}


////////////////////////////////////////////////////////////
export function char_is_identifier(s: string, i: number): boolean
{
    let c = s.charCodeAt(i);
    return (65 <= c && c <=  90) ||
           (48 <= c && c <=  57) ||
           (97 <= c && c <= 122) ||
           c === 95 ;
}