import { supabase } from "./supabase";

// ─────────────────────────────
// SIMPLE AUTH UI
// ─────────────────────────────
export function createAuthUI() {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.top = "10px";
  container.style.right = "10px";
  container.style.background = "#111";
  container.style.padding = "10px";
  container.style.color = "#fff";
  container.style.zIndex = "9999";
  container.style.width = "220px";
  container.style.fontFamily = "sans-serif";

  document.body.appendChild(container);

  // ─────────────────────────────
  // INPUTS
  // ─────────────────────────────
  const emailInput = document.createElement("input");
  emailInput.placeholder = "Email";
  emailInput.style.width = "100%";
  emailInput.style.marginBottom = "5px";

  const passwordInput = document.createElement("input");
  passwordInput.placeholder = "Password";
  passwordInput.type = "password";
  passwordInput.style.width = "100%";
  passwordInput.style.marginBottom = "5px";

  const usernameInput = document.createElement("input");
  usernameInput.placeholder = "Username";
  usernameInput.style.width = "100%";
  usernameInput.style.marginBottom = "5px";

  container.appendChild(emailInput);
  container.appendChild(passwordInput);
  container.appendChild(usernameInput);

  // ─────────────────────────────
  // BUTTONS
  // ─────────────────────────────
  const loginBtn = document.createElement("button");
  loginBtn.innerText = "Login";
  loginBtn.style.width = "100%";
  loginBtn.style.marginBottom = "5px";

  const registerBtn = document.createElement("button");
  registerBtn.innerText = "Register";
  registerBtn.style.width = "100%";

  container.appendChild(loginBtn);
  container.appendChild(registerBtn);

  // ─────────────────────────────
  // LOGIN
  // ─────────────────────────────
  loginBtn.onclick = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Logged in!");
    }
  };

  // ─────────────────────────────
  // REGISTER + USERNAME SYSTEM
  // ─────────────────────────────
  registerBtn.onclick = async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    const username = usernameInput.value;

    if (!username) {
      alert("Please enter a username");
      return;
    }

    // check username uniqueness
    const { data: existing } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .single();

    if (existing) {
      alert("Username already taken");
      return;
    }

    // create auth account
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });

    if (error) {
      alert(error.message);
      return;
    }

    // store username in profiles table
    if (data.user) {
      await supabase.from("profiles").insert({
        id: data.user.id,
        username
      });
    }

    alert("Account created!");
  };
}