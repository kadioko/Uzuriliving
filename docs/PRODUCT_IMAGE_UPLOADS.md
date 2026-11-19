# Product image uploads

In Inventory, choose **Add product** or edit an existing product and select a JPG, PNG, or WebP photo. The app prepares a square preview and tries to remove the background automatically. Check the preview carefully: small text, white packaging, transparent bottles, reflections, and fine edges can be difficult for the model. Select **Use original background** whenever the cutout is not right; both choices are resized and compressed. Then save the product.

Original files can be up to 15 MiB, with a maximum of 40 megapixels and 12,000 pixels per side. Saved images are JPEGs no larger than 1 MiB. The app first tries a 1024 × 1024 square and aims for about 300 KiB; it can reduce the quality or dimensions when necessary. Transparent areas and any unused space become white, and the complete photo is fitted without cropping. These are limits, not a guarantee of a particular image quality or file size.

Background removal and compression happen on the device. The first background-removal attempt downloads roughly 20 MB of model and runtime files from Hugging Face and jsDelivr; those services receive the normal network request information, but the product photo is not sent to them. The model is checked against a pinned SHA-256 hash and cached in the browser where storage is available. The selected processed image is uploaded to Uzuri Living's product-image storage only when the user saves. Offline or unsupported devices may need to retry or explicitly choose the original background. Users can clear a selection before saving.

Existing uploaded images are not changed automatically. Reopen and save a product with a newly selected photo to apply the new treatment. The browser preview is an aid, not a guarantee that automatic segmentation retained every product detail.

## Technical notes and attribution

- Model: U²-Net small (`u2netp`), by Xuebin Qin and coauthors, described in [U²-Net: Going Deeper with Nested U-Structure for Salient Object Detection](https://github.com/xuebinqin/U-2-Net). The upstream repository is licensed under [Apache 2.0](https://github.com/xuebinqin/U-2-Net/blob/master/LICENSE).
- The [pinned ONNX model mirror](https://huggingface.co/edgetools/u2netp/tree/25dee37ab19c5b6ad64ba6578eba63f1ae07720c) documents the conversion's origin, preprocessing, and model SHA-256. The application verifies that hash before use.
- Inference uses the MIT-licensed [ONNX Runtime Web](https://github.com/microsoft/onnxruntime); the runtime version and CDN path are pinned together. Model and runtime downloads may fail because of network, browser, policy, or storage restrictions; users can explicitly choose the original image instead.
- `npm run test:inventory` covers the upload flow without network-dependent AI downloads. To exercise the real hosted model and browser runtime, run `RUN_PRODUCT_AI_INTEGRATION=1 npx playwright test tests/product-image.spec.ts --grep "real on-device"` on a system with network access. On PowerShell set `$env:RUN_PRODUCT_AI_INTEGRATION='1'` first.
