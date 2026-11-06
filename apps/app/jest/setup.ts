// Every test uses the fake auth client (see src/test-utils/auth-mock.ts): no real Better Auth,
// network or secure storage. Tests drive the session with `setSession(...)`.
jest.mock("@/lib/auth-client", () => require("@/test-utils/auth-mock").authClientModule);

beforeEach(() => {
  require("@/test-utils/auth-mock").resetAuthMock();
});
