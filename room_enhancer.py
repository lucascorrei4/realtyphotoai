#!/usr/bin/env python3
"""Realty Room Enhancer
=======================

Utility that transforms existing real estate photos into modern, 
professionally styled images while preserving the original room.

It uses the Stable Diffusion *image-to-image* pipeline to add modern
furniture and décor based on a text prompt.
"""

from __future__ import annotations

import os
from datetime import datetime
from typing import Optional

from PIL import Image
import torch
from diffusers import StableDiffusionImg2ImgPipeline


class RealtyRoomEnhancer:
    """Generate improved room images using Stable Diffusion img2img."""

    def __init__(self, model_id: str = "runwayml/stable-diffusion-v1-5") -> None:
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            model_id,
            torch_dtype=torch.float16 if self.device.type == "cuda" else torch.float32,
            use_safetensors=True,
        )
        self.pipe = self.pipe.to(self.device)
        if self.device.type == "cuda":
            # Optimize memory usage on GPU
            self.pipe.enable_xformers_memory_efficient_attention()
            self.pipe.enable_model_cpu_offload()

    def enhance(
        self,
        image_path: str,
        style: str = "modern",
        strength: float = 0.75,
        guidance_scale: float = 7.5,
        negative_prompt: Optional[str] = None,
    ) -> str:
        """Enhance an existing room image adding modern interior elements.

        Args:
            image_path: Path to the original room image.
            style: Desired target style (default ``"modern"``).
            strength: How strongly to transform the image (0–1).
            guidance_scale: Classifier free guidance scale.
            negative_prompt: Optional negative prompt to avoid artifacts.

        Returns:
            Path to the generated image.
        """

        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image not found: {image_path}")

        image = Image.open(image_path).convert("RGB")

        prompt = (
            f"{style} interior design, professional real estate photography, "
            "high quality, realistic, polished, clean, elegant furniture, "
            "bright lighting, detailed textures"
        )

        if negative_prompt is None:
            negative_prompt = (
                "blurry, low quality, distorted, watermark, text, people, clutter, "
                "messy, dark, overexposed, underexposed"
            )

        with torch.autocast(self.device.type):
            result = self.pipe(
                prompt=prompt,
                image=image,
                strength=strength,
                guidance_scale=guidance_scale,
                negative_prompt=negative_prompt,
            ).images[0]

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        out_path = os.path.join("/workspace", f"enhanced_room_{timestamp}.png")
        result.save(out_path)
        return out_path


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Enhance room images with modern style.")
    parser.add_argument("image", help="Path to the input room image")
    parser.add_argument("--style", default="modern", help="Target interior style")
    parser.add_argument("--strength", type=float, default=0.75, help="Transformation strength (0-1)")
    args = parser.parse_args()

    enhancer = RealtyRoomEnhancer()
    out = enhancer.enhance(args.image, style=args.style, strength=args.strength)
    print(f"Enhanced image saved to: {out}")


if __name__ == "__main__":
    main()
