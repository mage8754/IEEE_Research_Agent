/**
 * Fictional sample texts for demonstration only. They do not describe real
 * publications, and the sample bibliography entries are not real references.
 */

export const GRAMMAR_SAMPLE = `In this paper, we propsed a novel attention-based framework for the the detection of anomalies in industrial IoT networks. The results shows that our method acheive higher accuracy then existing approaches , as reported in \\cite{demo2023anomaly}. Each sensor stream $x_t$ are normalised before training ,and an hybrid loss function is used to balance precision and recall.Furthermore the model require less parameters which make it suitable for edge deployment.`;

export const WRITING_SAMPLE = `So basically we made a new model that is really good at finding faults in solar panels. We got a lot of images from drones and we used a CNN to look at them. The model does way better than the old ones, as shown in Table~\\ref{tab:results}, and it doesn't need a lot of computing power, which is a big deal for farms that don't have good internet.`;

export const LATEX_SAMPLE = `We formulate the detection task as minimising the composite objective in Eq.~\\eqref{eq:objective}, following the formulation in \\cite{demo2021fusion, demo2022edge}.
\\begin{equation}
  \\mathcal{L} = \\lambda_1 \\mathcal{L}_{cls} + \\lambda_2 \\mathcal{L}_{box}
  \\label{eq:objective}
\\end{equation}
where $\\lambda_1$ and $\\lambda_2$ are weighting factors that was tuned on the validation split. As illustrated in Fig.~\\ref{fig:arch}, the backbone is \\textbf{frozen} during the first $10$ epochs so that the detection head can converge faster.`;

export const CITATION_TEX_SAMPLE = `\\section{Related Work}
Early surface inspection systems relied on handcrafted texture descriptors \\cite{demo2018texture}.
Convolutional approaches later improved robustness \\cite{demo2021fusion, demo2022edge}.
Transformer-based detectors were explored by \\citet{demo2023vit}, while lightweight
variants target embedded hardware \\citep[see][]{demo2020mobile}.
% \\cite{demo2017old} -- removed in revision
Our evaluation protocol follows \\cite{demo2022edge}.`;

export const CITATION_BIB_SAMPLE = `% Fictional sample bibliography for demonstration only
@article{demo2018texture,
  author  = {A. Sample and B. Example},
  title   = {Texture Descriptors for Surface Inspection (Sample Entry)},
  journal = {Demo Journal of Applied Vision},
  year    = {2018}
}
@inproceedings{demo2021fusion,
  author    = {C. Placeholder},
  title     = {Feature Fusion Networks (Sample Entry)},
  booktitle = {Demo Conference on Imaging},
  year      = {2021}
}
@inproceedings{demo2022edge,
  author    = {D. Fictional and E. Mock},
  title     = {Edge-Aware Detection (Sample Entry)},
  booktitle = {Demo Conference on Imaging},
  year      = {2022}
}
@article{demo2023vit,
  author  = {F. Instance},
  title   = {Vision Transformers for Defects (Sample Entry)},
  journal = {Demo Journal of Applied Vision}
}
@article{demo2019unused,
  author  = {G. Specimen},
  title   = {An Entry That Is Never Cited (Sample Entry)},
  journal = {Demo Journal of Applied Vision},
  year    = {2019}
}`;

export const LITERATURE_SAMPLES = [
  {
    title: "Sample Paper A — Lightweight CNN for Leaf Disease Detection (fictional)",
    text: `Abstract: This fictional sample study proposes a lightweight convolutional neural network for classifying leaf diseases on low-cost smartphones. The model uses depthwise separable convolutions and is trained on a sample dataset of 12,000 labelled leaf images across 8 classes collected in the authors' own field trials. Images were augmented with rotation and colour jitter. The network reaches 94.1% top-1 accuracy on the held-out test split while requiring 2.3 million parameters. Limitations: images were captured under daylight only, and the dataset covers a single crop variety. Future work will evaluate performance under varying illumination.`,
  },
  {
    title: "Sample Paper B — Vision Transformer for Crop Disease Classification (fictional)",
    text: `Abstract: This fictional sample work evaluates a Vision Transformer (ViT-Small) pretrained on generic images and fine-tuned for crop disease classification. Experiments use a sample public-style dataset of 30,000 images spanning 14 crops and 26 disease classes, with a 70/15/15 split. The fine-tuned model achieves 97.3% accuracy and outperforms a ResNet-50 baseline by 2.1 percentage points. However, inference requires a GPU and averages 180 ms per image on a mobile CPU. The authors note that the dataset images have uniform backgrounds, which may not reflect real field conditions.`,
  },
  {
    title: "Sample Paper C — Federated Learning for On-Farm Disease Monitoring (fictional)",
    text: `Abstract: In this fictional sample paper, a federated learning framework trains a disease classifier across 20 simulated farms without centralising images. Each farm holds a non-IID partition of a sample dataset of 18,000 images. Using FedAvg with a MobileNetV3 backbone, the global model reaches 91.8% accuracy after 50 communication rounds, compared with 93.0% for centralised training. Communication cost is reduced by 40% through update compression. Limitations include the simulated network setting and the absence of real farm deployment; robustness to malicious clients is not studied.`,
  },
];

export const REVIEWER_SAMPLE = `Title: Edge-Deployed Anomaly Detection for Smart Grid Sensors (fictional sample manuscript)

Abstract
This fictional manuscript presents an autoencoder-based anomaly detector for smart grid voltage sensors that runs on a microcontroller. The approach compresses sensor windows and flags reconstruction errors above a threshold. Experiments on a sample dataset of 2 million readings show an F1-score of 0.91. The method is efficient and very promising for future grids.

1. Introduction
Smart grids rely on thousands of sensors and anomalies can cause outages. Existing methods are mostly cloud-based which increases latency. In this paper we propose an approach that runs on the edge. Our contributions are an efficient model and an evaluation.

2. Methodology
We use a three-layer autoencoder with 64, 16 and 64 neurons. Sensor readings are split into windows of 50 samples. The threshold is chosen as the 99th percentile of reconstruction error on training data. The model is quantised to 8-bit integers and deployed on a microcontroller with 256 KB of RAM. Training used the Adam optimiser.

3. Results
On the test set the model achieves precision 0.89, recall 0.93 and F1 0.91. Inference takes 4 ms per window. Compared with a cloud baseline, latency is reduced significantly. The model uses 38 KB of memory after quantisation.

4. Conclusion
We presented an edge anomaly detector that achieves good accuracy with low latency. In future work we will test more datasets.`;

export const HUMANIZER_SAMPLE = `In this work, we propose a method that is proposed to detect faults in photovoltaic panels. The proposed method uses a convolutional neural network and the convolutional neural network is trained on 12,400 drone images \\cite{demo2022edge}. The results show that the results of the method reach 94.7\\% accuracy, which is higher than the baseline in Table~\\ref{tab:results}. It is important to note that the method is lightweight and it can also run on edge devices, and it needs only $3.2$~M parameters.`;

export const LATEX_CODE_SAMPLE = `% Fictional sample section for demonstration only
\\section{Experimental Results}
As shown in Fig. \\ref{fig:pipeline}, the detector is evaluated on the "SolarFault" benchmark \\cite{demo2022edge}\\cite{demo2021fusion}.
We report {\\bf precision}, recall and F1-score... The overall loss is
$$ \\mathcal{L} = \\mathcal{L}_{cls} + \\lambda \\mathcal{L}_{box} $$
where $\\lambda = 0.5$.
\\begin{figure}[h]
  \\centering
  \\label{fig:pipeline}
  \\includegraphics[width=\\columnwidth]{pipeline}
  \\caption{Overview of the detection pipeline.}
\\end{figure}
\\begin{table}[h]
  \\centering
  \\begin{tabular}{|l|c|c|}
    \\hline
    Method & Precision & Recall \\\\ \\hline
    Baseline & 0.81 & 0.77 \\\\
    Ours & 0.91 & 0.88 \\\\ \\hline
  \\end{tabular}
\\end{table}
Detailed ablations are given in Section \\ref{sec:ablation}.`;
