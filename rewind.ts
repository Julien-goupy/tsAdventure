export interface Rewinder
{
    mutationHistory: any[];
    rewindCursor   : number
}

export function rewinder_get(): Rewinder
{
    return {
               mutationHistory: [],
               rewindCursor   : 0
           };
}



////////////////////////////////////////////////////////////
export function rewinder_add_mutation(rewinder: Rewinder, mutation: any)
{
    rewinder.mutationHistory.splice(rewinder.rewindCursor);
    rewinder.mutationHistory.push(mutation);
    rewinder.rewindCursor = rewinder.mutationHistory.length;
}


////////////////////////////////////////////////////////////
export function rewinder_pop_mutation(rewinder: Rewinder): any
{
    if (rewinder.rewindCursor > 0)
    {
        rewinder.rewindCursor -= 1;
        return rewinder.mutationHistory[rewinder.rewindCursor];
    }

    return null;
}


////////////////////////////////////////////////////////////
export function rewinder_redo_mutation(rewinder: Rewinder): any
{
    if (rewinder.rewindCursor >= rewinder.mutationHistory.length)
    {
        rewinder.rewindCursor = rewinder.mutationHistory.length;
        return null;
    }
    else
    {
        let mutation = rewinder.mutationHistory[rewinder.rewindCursor];
        rewinder.rewindCursor += 1;
        return mutation;
    }
}




// TEMP
export interface TextMutation
{
    cursor      : number;
    deletedText : string;
    insertedText: string;
}