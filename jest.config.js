
module.exports = {
    preset: "ts-jest",
    testEnvironment: "node",
    testPathIgnorePatterns: ["boneyard/"],
    collectCoverageFrom: [
        'src/**/*.ts',
    ],
    coverageReporters: [
        "text",
        "lcov",
        "html"
    ]
};
