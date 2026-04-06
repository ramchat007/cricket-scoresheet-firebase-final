// helpers.js
export const isTab = (currentTab, tabName) => currentTab === tabName;

export const formatCurrency = (val) => `₹${(val || 0).toLocaleString()}`;

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

// --- CLOUDINARY UPLOAD HELPER ---
export const uploadBase64ToCloudinary = async (base64Image) => {
  const formData = new FormData();
  formData.append("file", base64Image);
  formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET); // 👈 CHANGE THIS
  formData.append("cloud_name", CLOUDINARY_CLOUD_NAME); // 👈 CHANGE THIS

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, // 👈 CHANGE THIS
      {
        method: "POST",
        body: formData,
      },
    );
    const data = await response.json();
    if (!data.secure_url) throw new Error("Failed to get URL from Cloudinary");
    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary Error:", error);
    throw error;
  }
};
