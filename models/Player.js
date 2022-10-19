class Character {
    constructor(name = '') {
        this.name = name;
        this.health = ''
        this.attack = ''
    }


isAlive() {
    if (this.health === 0) {
        return false;
    }
    return true
}
}
