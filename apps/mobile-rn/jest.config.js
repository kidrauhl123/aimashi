// 只测 src/logic 与 src/api 的纯函数(node 环境,不拉 RN native)。
// 组件/屏幕的真机验证走 EAS dev/preview build。
module.exports = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  transform: {
    "^.+\\.ts$": ["ts-jest", { tsconfig: "tsconfig.jest.json" }],
  },
};
