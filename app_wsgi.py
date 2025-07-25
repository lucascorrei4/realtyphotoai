import gradio as gr
import os
import tempfile
from real_estate_agent import RealEstateGraphicDesigner

# Initialize the agent
agent = None

def initialize_agent():
    """Initialize the agent with proper error handling"""
    global agent
    try:
        agent = RealEstateGraphicDesigner()
        return "Agent initialized successfully!"
    except Exception as e:
        return f"Error initializing agent: {str(e)}"

def process_uploaded_image(image):
    """Process uploaded image and return enhancement suggestion"""
    global agent
    
    if agent is None:
        init_result = initialize_agent()
        if "Error" in init_result:
            return init_result
    
    if image is None:
        return "Please upload an image first."
    
    try:
        # Save uploaded image to temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.jpg') as tmp_file:
            image.save(tmp_file.name)
            temp_path = tmp_file.name
        
        # Process the image
        suggestion = agent.process_image(temp_path)
        
        # Clean up temporary file
        os.unlink(temp_path)
        
        return suggestion
        
    except Exception as e:
        return f"Error processing image: {str(e)}"

def get_sample_suggestions():
    """Return sample enhancement suggestions for different room types"""
    samples = {
        "Living Room (Modern)": "Add a sleek sectional sofa in neutral tones, remove outdated furniture",
        "Kitchen (Contemporary)": "Install pendant lighting, add subway tile backsplash, upgrade to stainless steel appliances",
        "Bedroom (Minimalist)": "Add a platform bed with built-in storage, incorporate natural lighting",
        "Bathroom (Spa-like)": "Install a rainfall shower head, add floating vanity, use natural stone tiles"
    }
    
    result = "🏠 **Sample Enhancement Suggestions:**\n\n"
    for room_type, suggestion in samples.items():
        result += f"**{room_type}:**\n{suggestion}\n\n"
    
    return result

# Create Gradio interface
def create_interface():
    with gr.Blocks(
        title="🏠 Real Estate AI Designer",
        theme=gr.themes.Soft(),
        css="""
        .gradio-container {
            max-width: 1200px !important;
            margin: auto !important;
        }
        """
    ) as demo:
        
        gr.Markdown("""
        # 🏠 Ultra-Realistic Real Estate Graphic Designer
        
        Upload a room photo and get professional enhancement suggestions for real estate marketing.
        Our AI analyzes room types, architectural styles, and suggests photorealistic improvements.
        """)
        
        with gr.Tab("📸 Image Analysis"):
            with gr.Row():
                with gr.Column(scale=1):
                    image_input = gr.Image(
                        type="pil",
                        label="Upload Room Photo",
                        height=400
                    )
                    
                    analyze_btn = gr.Button(
                        "🔍 Analyze & Get Suggestions",
                        variant="primary",
                        size="lg"
                    )
                
                with gr.Column(scale=1):
                    output_text = gr.Textbox(
                        label="Enhancement Suggestions",
                        lines=20,
                        max_lines=25,
                        placeholder="Upload an image and click 'Analyze' to get enhancement suggestions..."
                    )
            
            analyze_btn.click(
                fn=process_uploaded_image,
                inputs=[image_input],
                outputs=[output_text]
            )
        
        with gr.Tab("📋 Sample Suggestions"):
            gr.Markdown("Here are some example enhancement suggestions for different room types:")
            
            sample_btn = gr.Button("Show Sample Suggestions", variant="secondary")
            sample_output = gr.Textbox(
                label="Sample Enhancement Ideas",
                lines=15,
                max_lines=20
            )
            
            sample_btn.click(
                fn=get_sample_suggestions,
                outputs=[sample_output]
            )
        
        with gr.Tab("ℹ️ About"):
            gr.Markdown("""
            ## Features
            
            - **Multi-Room Support**: Living rooms, bedrooms, kitchens, bathrooms, and more
            - **Style Recognition**: Identifies architectural styles (modern, traditional, rustic, etc.)
            - **Intelligent Analysis**: Detects clutter, empty spaces, and editable areas
            - **Photorealistic Suggestions**: Provides actionable enhancement recommendations
            - **Structure Preservation**: Maintains windows, doors, and room layout integrity
            
            ## How to Use
            
            1. **Upload Image**: Select a clear photo of the room you want to enhance
            2. **Analyze**: Click the analyze button to get AI-powered suggestions
            3. **Review**: Read the detailed enhancement recommendations
            4. **Implement**: Use the suggestions to improve your real estate photos
            
            ## Supported Room Types
            
            - Living Rooms & Family Rooms
            - Bedrooms & Master Suites
            - Kitchens & Dining Areas
            - Bathrooms & Powder Rooms
            - Home Offices & Studies
            - Outdoor Spaces & Patios
            """)
    
    return demo

# Create the Gradio app
app = create_interface()

# For Gunicorn compatibility
if __name__ == "__main__":
    # Development mode
    app.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False
    )
else:
    # Production mode with Gunicorn
    # Gradio apps can be served with Gunicorn using the app object
    pass