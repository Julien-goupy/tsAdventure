let   currentId = 0;
const map       = new WeakMap();


////////////////////////////////////////////////////////////
export function debug_id(object: any)
{
    if (object === null)      return -1;
    if (object === undefined) return -2;

    let objectId = map.get(object);
    if (objectId === undefined)
    {
        objectId = currentId;
        currentId += 1;
        map.set(object, objectId);
    }

    return objectId;
};
