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
        "Kitchen (Modern)": "Enhance countertops with quartz surfaces, remove clutter including dishes",
        "Bedroom (Traditional)": "Add classic wooden bed frame, remove modern elements",
        "Bathroom (Modern)": "Enhance vanity with modern vessel sink, remove personal toiletries",
        "Balcony (Contemporary)": "Add contemporary outdoor furniture, remove weathered items",
        "Garden (Traditional)": "Add classic garden borders with colorful flowers, remove dead plants"
    }
    return "\n".join([f"• {room}: {suggestion}" for room, suggestion in samples.items()])

# Create Gradio interface
with gr.Blocks(title="Ultra-Realistic Real Estate Graphic Designer", theme=gr.themes.Soft()) as demo:
    gr.Markdown("""
    # 🏠 Ultra-Realistic Real Estate Graphic Designer
    
    Upload a photo of any room in your house and get professional enhancement suggestions!
    
    **Specializes in:** Living rooms, bedrooms, kitchens, bathrooms, balconies, gardens, pools, bungalows, and more.
    
    **Features:**
    - Analyzes room style (modern, traditional, rustic, etc.)
    - Identifies key editable areas
    - Detects clutter and empty spaces
    - Provides photorealistic enhancement suggestions
    - Preserves structural elements (windows, doors, etc.)
    """)
    
    with gr.Row():
        with gr.Column(scale=1):
            # Image upload
            image_input = gr.Image(
                label="Upload Room Photo",
                type="pil",
                height=400
            )
            
            # Process button
            process_btn = gr.Button(
                "🎨 Generate Enhancement Suggestion",
                variant="primary",
                size="lg"
            )
            
        with gr.Column(scale=1):
            # Output
            output_text = gr.Textbox(
                label="Enhancement Suggestion",
                lines=6,
                placeholder="Upload an image and click 'Generate Enhancement Suggestion' to get started...",
                interactive=False
            )
            
            # Additional info
            gr.Markdown("""
            ### 💡 How it works:
            1. **Upload** a photo of any room
            2. **AI Analysis** identifies room type, style, and areas for improvement
            3. **Get Suggestion** receives a detailed, actionable enhancement recommendation
            
            ### 🎯 What you'll get:
            - Specific furniture and decor recommendations
            - Clutter removal suggestions
            - Style-appropriate enhancements
            - Photorealistic improvement ideas
            """)
    
    # Sample suggestions section
    with gr.Accordion("📋 Sample Enhancement Suggestions", open=False):
        sample_text = gr.Textbox(
            label="Examples of Enhancement Suggestions",
            value=get_sample_suggestions(),
            lines=8,
            interactive=False
        )
    
    # Connect the button to the processing function
    process_btn.click(
        fn=process_uploaded_image,
        inputs=image_input,
        outputs=output_text
    )
    
    # Footer
    gr.Markdown("""
    ---
    **Note:** This AI agent specializes in photorealistic enhancements while preserving structural elements like windows, doors, and room layout. 
    All suggestions focus on achievable improvements using furniture, decor, lighting, and organization.
    """)

# Launch the app
if __name__ == "__main__":
    port = int(os.environ.get("PORT", 7860))
    demo.launch(
        server_name="0.0.0.0",
        server_port=port,
        share=False
    )