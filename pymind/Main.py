
import os
import requests
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

AI_NAME = "PyMind"
API_KEY = os.getenv("OPENROUTER_API_KEY")
API_URL = "https://openrouter.ai/api/v1/chat/completions"

st.set_page_config(
    page_title="PyMind AI",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
.stApp {
    background: #0b1020;
    color: #edf2ff;
}
[data-testid="stSidebar"] {
    background: #10172a;
    border-right: 1px solid #27324a;
}
[data-testid="stChatMessage"] {
    background: #141d32;
    border: 1px solid #27324a;
    border-radius: 16px;
    padding: 14px;
    margin-bottom: 12px;
}
.stChatInput textarea {
    background: #141d32;
}
h1, h2, h3 {
    letter-spacing: -0.5px;
}
.pymind-subtitle {
    color: #9ba9c7;
    font-size: 15px;
}
</style>
""", unsafe_allow_html=True)

with st.sidebar:
    st.markdown("# 🧠 PyMind")
    st.caption("Your personal AI assistant")
    st.divider()

    model = st.selectbox(
        "AI model",
        [
            "openrouter/free",
            "openai/gpt-4o-mini",
            "google/gemini-2.5-flash",
        ],
        index=0,
    )

    st.caption("Some models may require availability or credits.")

    if st.button("＋ New chat", use_container_width=True):
        st.session_state.messages = []
        st.rerun()

    st.divider()
    st.markdown("### ⚙️ Settings")
    st.caption("Provider: OpenRouter")
    st.caption("Interface: Streamlit")

    if st.button("🗑️ Clear conversation",
                 use_container_width=True):
        st.session_state.messages = []
        st.rerun()

st.markdown("# 🧠 PyMind AI")
st.markdown(
    '<p class="pymind-subtitle">'
    'Think smarter. Create faster. Ask anything.'
    '</p>',
    unsafe_allow_html=True,
)
st.divider()


def get_reply(messages, selected_model):
    if not API_KEY:
        return (
            "API key missing! Add OPENROUTER_API_KEY "
            "to your .env file."
        )

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }

    payload = {
        "model": selected_model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are PyMind, a helpful AI assistant. "
                    "Reply in Hinglish when appropriate. "
                    "Use clear formatting and code blocks when useful."
                ),
            },
            *messages,
        ],
    }

    try:
        response = requests.post(
            API_URL,
            headers=headers,
            json=payload,
            timeout=(10, 60),
        )

        response.raise_for_status()
        result = response.json()
        answer = result["choices"][0]["message"]["content"]

        if not isinstance(answer, str) or not answer.strip():
            return "The model returned an empty response."

        return answer

    except requests.exceptions.Timeout:
        return "Request timed out. Please try again."

    except requests.exceptions.HTTPError:
        try:
            detail = response.json().get("error", {}).get(
                "message", response.text[:300]
            )
        except ValueError:
            detail = response.text[:300]

        return f"OpenRouter error ({response.status_code}): {detail}"

    except requests.exceptions.RequestException as error:
        return f"Network error: {error}"

    except (KeyError, IndexError, TypeError, ValueError):
        return "Invalid response received from the AI provider."


if "messages" not in st.session_state:
    st.session_state.messages = []

if not st.session_state.messages:
    st.markdown("### What can I help you with?")
    col1, col2, col3 = st.columns(3)

    suggestions = [
        ("💻 Coding", "Help me build a Python project"),
        ("📚 Learning", "Explain a difficult topic simply"),
        ("💡 Ideas", "Give me 5 creative AI project ideas"),
    ]

    for col, (label, prompt) in zip(
        [col1, col2, col3], suggestions
    ):
        with col:
            if st.button(label, use_container_width=True):
                st.session_state.pending_prompt = prompt
                st.rerun()

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

prompt = st.chat_input("Message PyMind...")

if "pending_prompt" in st.session_state:
    prompt = st.session_state.pop("pending_prompt")

if prompt:
    st.session_state.messages.append({
        "role": "user",
        "content": prompt,
    })

    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("PyMind is thinking..."):
            reply = get_reply(
                st.session_state.messages,
                model,
            )
        st.markdown(reply)

    st.session_state.messages.append({
        "role": "assistant",
        "content": reply,
    })
