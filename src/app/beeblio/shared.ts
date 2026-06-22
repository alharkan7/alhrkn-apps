export type Paper = {
  id: string
  title: string
  authors: string[]
  year: number
  citations: number
  source: string
  abstract: string
  overallScore?: number
  rubrics?: {
    relevance: number
    methodology: number
    novelty: number
  }
  url?: string
}

export const MOCK_RESULTS: Paper[] = [
  {
    id: '1',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer', 'Niki Parmar', 'Jakob Uszkoreit'],
    year: 2017,
    citations: 125432,
    source: 'NeurIPS',
    abstract: 'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks that include an encoder and a decoder. The best performing models also connect the encoder and decoder through an attention mechanism. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.',
    overallScore: 9.6,
    rubrics: {
      relevance: 9.5,
      methodology: 9.8,
      novelty: 9.5
    },
    url: 'https://arxiv.org/abs/1706.03762'
  },
  {
    id: '2',
    title: 'BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding',
    authors: ['Jacob Devlin', 'Ming-Wei Chang', 'Kenton Lee', 'Kristina Toutanova'],
    year: 2018,
    citations: 89320,
    source: 'NAACL-HLT',
    abstract: 'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers. Unlike recent language representation models, BERT is designed to pre-train deep bidirectional representations from unlabeled text by jointly conditioning on both left and right context in all layers.',
    overallScore: 9.3,
    rubrics: {
      relevance: 9.0,
      methodology: 9.4,
      novelty: 9.5
    },
    url: 'https://arxiv.org/abs/1810.04805'
  },
  {
    id: '3',
    title: 'Language Models are Few-Shot Learners',
    authors: ['Tom B. Brown', 'Benjamin Mann', 'Nick Ryder', 'Melanie Subbiah'],
    year: 2020,
    citations: 45000,
    source: 'NeurIPS',
    abstract: 'Recent work has demonstrated substantial gains on many NLP tasks and benchmarks by pre-training on a large corpus of text followed by fine-tuning on a specific task. While typically task-agnostic in architecture, this method still requires task-specific fine-tuning datasets of thousands or tens of thousands of examples. By contrast, humans can generally perform a new language task from only a few examples.',
    overallScore: 8.9,
    rubrics: {
      relevance: 8.5,
      methodology: 9.2,
      novelty: 9.0
    },
    url: 'https://arxiv.org/abs/2005.14165'
  },
  {
    id: '4',
    title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
    authors: ['Patrick Lewis', 'Ethan Perez', 'Aleksandra Piktus', 'Fabio Petroni'],
    year: 2020,
    citations: 12500,
    source: 'NeurIPS',
    abstract: 'Large pre-trained language models have been shown to store factual knowledge in their parameters, and achieve state-of-the-art results when fine-tuned on downstream NLP tasks. However, their ability to access and precisely manipulate knowledge is still limited. We explore models which combine pre-trained parametric and non-parametric memory for language generation.',
    overallScore: 9.1,
    rubrics: {
      relevance: 9.8,
      methodology: 8.5,
      novelty: 9.0
    },
    url: 'https://arxiv.org/abs/2005.11401'
  }
]
