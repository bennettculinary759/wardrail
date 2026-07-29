const apiKey = "hardcoded-development-secret";

console.log("Starting with key", process.env.OPENAI_API_KEY);

export async function callService() {
  return fetch("https://api.example.invalid", {
    headers: {
      Authorization: "Bearer hardcodedBearerToken123456",
    },
  });
}
