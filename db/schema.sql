CREATE TABLE characters (
    id INTEGER AUTO_INCREMENT PRIMARY KEY,
    tier VARCHAR(1) NOT NULL,
    name VARCHAR(30) NOT NULL,
    attack INTEGER NOT NULL,
    defense INTEGER NOT NULL,
    sacrifice INTEGER
);

CREATE TABLE gamestats (
    win BOOLEAN NOT NULL,
    userid INTEGER NOT NULL,
    gameid INTEGER AUTO_INCREMENT PRIMARY KEY,
    CONSTRAINT fk_party FOREIGN KEY (userid) REFERENCES users(id) ON DELETE SET NULL
)

CREATE TABLE users (
    id INTEGER AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(1) NOT NULL,
    password VARCHAR(30) NOT NULL,
    email INTEGER NOT NULL
);

--create user db w/ player seeds add properties that need to be updated (record) -> join gamestats and users on foreignKey (userid)
--keep record from dropping 